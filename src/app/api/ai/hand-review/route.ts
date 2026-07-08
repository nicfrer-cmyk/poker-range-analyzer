import { NextResponse, type NextRequest } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { createClient } from "@/lib/supabase/server";
import { checkAndIncrementAiQuota } from "@/lib/aiUsage";
import { ALLOWED_IMAGE_MEDIA_TYPES, MAX_IMAGE_BASE64_LENGTH, type AllowedImageMediaType } from "@/lib/aiImage";

// ---------------------------------------------------------------------------
// AI Hand Review — post-game only, never live-play.
//
// Takes a structured hand summary (from a saved analysis), raw pasted hand-
// history text, OR a table screenshot, and asks Claude for a plain-Hebrew,
// street-by-street review. For a screenshot, the same call both reads the
// hand off the image and writes the review — one vision request, not a
// round-trip through /api/ai/parse-screenshot first, so an image-based
// review only spends one unit of the shared daily AI quota, same as a text
// one. Requires ANTHROPIC_API_KEY; without it, returns a clear 501 so the UI
// can show "not configured yet" instead of a generic failure.
//
// Requires a signed-in Supabase user (same check as /api/grow/checkout) —
// this calls a paid third-party API on the server's own credentials. The
// daily free-tier limit is enforced for real here via checkAndIncrementAiQuota
// (see lib/aiUsage.ts), against the user's actual `users.plan` — not just the
// client-side localStorage counter in ai-review/page.tsx, which only drives
// the UI and is trivially bypassable by calling this route directly.
// ---------------------------------------------------------------------------

const REVIEW_RULES = `אתה מאמן פוקר שכותב סקירות יד לשחקנים חובבים ומתקדמים, בעברית פשוטה וברורה.

חוקים חשובים:
- זהו ניתוח לימודי לאחר סיום היד בלבד. לעולם אל תיתן המלצה לפעולה "עכשיו" או בזמן אמת — היד כבר הסתיימה.
- אל תבטיח רווחים או תוצאות כספיות. התמקד בהבנה, בלמידה ובזיהוי דפוסים.
- כתוב בשפה אנושית וברורה, לא בשפת סולבר טכנית (למשל "אתה פייבוריט ענק" ולא "0.72 אקוויטי בתדירות 0.68").
- היה תמציתי — 2-4 משפטים לכל סעיף.`;

const TEXT_SYSTEM_PROMPT = `${REVIEW_RULES}
- ענה בפורמט הבא בדיוק, עם הכותרות האלה:

## תקציר היד
## נקודת ההחלטה המרכזית
## מה Hero עשה
## מה היה הסיכון
## ידיים רלוונטיות בטווח היריב
## מה אפשר ללמוד להבא`;

const IMAGE_SYSTEM_PROMPT = `${REVIEW_RULES}
- קיבלת צילום מסך של שולחן פוקר, לא טקסט. קודם כול זהה בקצרה את פרטי היד הגלויים בתמונה
  (קלפי הירו, הבורד, גודל הפוט, הפוזיציה אם ניתן) — ואם משהו לא ברור, ציין זאת בפירוש במקום
  לנחש. רק אחר כך המשך לניתוח עצמו.
- אם התמונה אינה שולחן פוקר או שלא ניתן לזהות ממנה שום דבר בביטחון, אמור זאת בבירור בסעיף
  הראשון ואל תמשיך לנתח.
- ענה בפורמט הבא בדיוק, עם הכותרות האלה:

## מה זוהה בתמונה
## תקציר היד
## נקודת ההחלטה המרכזית
## מה Hero עשה
## מה היה הסיכון
## ידיים רלוונטיות בטווח היריב
## מה אפשר ללמוד להבא`;

interface HandReviewRequestBody {
  handSummary?: string;
  handHistoryText?: string;
  imageBase64?: string;
  mediaType?: string;
}

export async function POST(request: NextRequest) {
  let userId: string;
  try {
    const supabase = await createClient();
    const {
      data: { user },
      error,
    } = await supabase.auth.getUser();
    if (error || !user) {
      return NextResponse.json({ error: "יש להתחבר כדי להשתמש בניתוח ה-AI." }, { status: 401 });
    }
    userId = user.id;
  } catch (err) {
    if (err instanceof Error && err.message.startsWith("Supabase is not configured")) {
      return NextResponse.json(
        { error: "Supabase is not configured yet, so there is no signed-in user to check." },
        { status: 501 }
      );
    }
    throw err;
  }

  const quota = await checkAndIncrementAiQuota(userId);
  if (!quota.allowed) {
    return NextResponse.json({ error: quota.reason }, { status: 429 });
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      {
        error:
          "ניתוח AI טרם הוגדר — נדרש מפתח Anthropic API בצד השרת (ANTHROPIC_API_KEY).",
      },
      { status: 501 }
    );
  }

  let body: HandReviewRequestBody;
  try {
    body = (await request.json()) as HandReviewRequestBody;
  } catch {
    return NextResponse.json({ error: "גוף הבקשה אינו JSON תקין." }, { status: 400 });
  }

  const { handSummary, handHistoryText, imageBase64, mediaType } = body;

  if (imageBase64 && mediaType) {
    if (!ALLOWED_IMAGE_MEDIA_TYPES.has(mediaType)) {
      return NextResponse.json(
        { error: "סוג קובץ לא נתמך — יש להעלות JPEG, PNG, GIF או WebP." },
        { status: 400 }
      );
    }
    if (imageBase64.length > MAX_IMAGE_BASE64_LENGTH) {
      return NextResponse.json({ error: "התמונה גדולה מדי." }, { status: 400 });
    }
  }

  const userContent = handHistoryText?.trim()
    ? `הנה היסטוריית יד גולמית לניתוח:\n\n${handHistoryText.trim()}`
    : handSummary?.trim()
    ? `הנה תקציר היד לניתוח:\n\n${handSummary.trim()}`
    : null;

  if (!userContent && !(imageBase64 && mediaType)) {
    return NextResponse.json(
      { error: "יש לספק handSummary, handHistoryText או תמונה לניתוח." },
      { status: 400 }
    );
  }

  try {
    const client = new Anthropic({ apiKey });
    const response = await client.messages.create({
      model: "claude-opus-4-8",
      max_tokens: 1024,
      system: imageBase64 && mediaType ? IMAGE_SYSTEM_PROMPT : TEXT_SYSTEM_PROMPT,
      messages: [
        {
          role: "user",
          content:
            imageBase64 && mediaType
              ? [
                  {
                    type: "image" as const,
                    source: {
                      type: "base64" as const,
                      media_type: mediaType as AllowedImageMediaType,
                      data: imageBase64,
                    },
                  },
                  { type: "text" as const, text: "נתח את היד הנראית בתמונה, לפי ההנחיות שסופקו." },
                ]
              : userContent!,
        },
      ],
    });

    const textBlock = response.content.find((b) => b.type === "text");
    if (!textBlock || textBlock.type !== "text") {
      return NextResponse.json(
        { error: "לא התקבלה תשובת טקסט מהמודל." },
        { status: 502 }
      );
    }

    return NextResponse.json({ review: textBlock.text });
  } catch (err) {
    const message = err instanceof Error ? err.message : "שגיאה לא ידועה";
    return NextResponse.json(
      { error: `שגיאה בקריאה ל-AI: ${message}` },
      { status: 502 }
    );
  }
}
