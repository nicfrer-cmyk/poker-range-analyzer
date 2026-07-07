import { NextResponse, type NextRequest } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { createClient } from "@/lib/supabase/server";

// ---------------------------------------------------------------------------
// AI Hand Review — post-game only, never live-play.
//
// Takes either a structured hand summary (from a saved analysis) or raw
// pasted hand-history text, and asks Claude for a plain-Hebrew, street-by-
// street review. Requires ANTHROPIC_API_KEY; without it, returns a clear
// 501 so the UI can show "not configured yet" instead of a generic failure.
//
// Requires a signed-in Supabase user (same check as /api/grow/checkout) —
// this calls a paid third-party API on the server's own credentials, and the
// daily free-tier limit (see lib/plan.ts's dailyAiReviewLimit) is enforced
// only client-side in ai-review/page.tsx, so without this check anyone on
// the internet could hit this route directly to run up the Anthropic bill
// and bypass the free-plan limit entirely.
// ---------------------------------------------------------------------------

const SYSTEM_PROMPT = `אתה מאמן פוקר שכותב סקירות יד לשחקנים חובבים ומתקדמים, בעברית פשוטה וברורה.

חוקים חשובים:
- זהו ניתוח לימודי לאחר סיום היד בלבד. לעולם אל תיתן המלצה לפעולה "עכשיו" או בזמן אמת — היד כבר הסתיימה.
- אל תבטיח רווחים או תוצאות כספיות. התמקד בהבנה, בלמידה ובזיהוי דפוסים.
- כתוב בשפה אנושית וברורה, לא בשפת סולבר טכנית (למשל "אתה פייבוריט ענק" ולא "0.72 אקוויטי בתדירות 0.68").
- ענה בפורמט הבא בדיוק, עם הכותרות האלה:

## תקציר היד
## נקודת ההחלטה המרכזית
## מה Hero עשה
## מה היה הסיכון
## ידיים רלוונטיות בטווח היריב
## מה אפשר ללמוד להבא

היה תמציתי — 2-4 משפטים לכל סעיף.`;

interface HandReviewRequestBody {
  handSummary?: string;
  handHistoryText?: string;
}

export async function POST(request: NextRequest) {
  try {
    const supabase = createClient();
    const {
      data: { user },
      error,
    } = await supabase.auth.getUser();
    if (error || !user) {
      return NextResponse.json({ error: "יש להתחבר כדי להשתמש בניתוח ה-AI." }, { status: 401 });
    }
  } catch (err) {
    if (err instanceof Error && err.message.startsWith("Supabase is not configured")) {
      return NextResponse.json(
        { error: "Supabase is not configured yet, so there is no signed-in user to check." },
        { status: 501 }
      );
    }
    throw err;
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

  const { handSummary, handHistoryText } = body;
  const userContent = handHistoryText?.trim()
    ? `הנה היסטוריית יד גולמית לניתוח:\n\n${handHistoryText.trim()}`
    : handSummary?.trim()
    ? `הנה תקציר היד לניתוח:\n\n${handSummary.trim()}`
    : null;

  if (!userContent) {
    return NextResponse.json(
      { error: "יש לספק handSummary או handHistoryText לניתוח." },
      { status: 400 }
    );
  }

  try {
    const client = new Anthropic({ apiKey });
    const response = await client.messages.create({
      model: "claude-opus-4-8",
      max_tokens: 1024,
      system: SYSTEM_PROMPT,
      messages: [{ role: "user", content: userContent }],
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
