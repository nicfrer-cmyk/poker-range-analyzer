import { NextResponse, type NextRequest } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { createClient } from "@/lib/supabase/server";
import type { Card } from "@/lib/engine/types";

// ---------------------------------------------------------------------------
// AI screenshot parsing — the "analyze from screenshot" entry point in the
// importer (`HandHistoryImporter.tsx`) was a stub waiting on a vision-capable
// model. Claude's vision input covers that: given a table screenshot, ask it
// to read back hero cards / board / pot / position as strict JSON.
//
// Same auth + ANTHROPIC_API_KEY gating as /api/ai/hand-review, and for the
// same reason — this is a paid third-party API call on the server's own
// credentials, so it must not be reachable by a signed-out caller.
// ---------------------------------------------------------------------------

const CARD_RE = /^[2-9TJQKA][shdc]$/;

const SYSTEM_PROMPT = `אתה מזהה מידע מתוך צילום מסך של שולחן פוקר (אונליין, כל פלטפורמה).

המשימה שלך: לזהות אך ורק את מה שנראה בבירור בתמונה, ולהחזיר JSON תקין בלבד — ללא טקסט
נוסף, ללא הסברים, ללא markdown code fences.

פורמט הקלף: אות דרגה (2-9,T,J,Q,K,A) ואות קבוצה קטנה (s,h,d,c), למשל "As", "Th", "9c".

סכימת הפלט (כל שדה אופציונלי — השמט שדה שאינך בטוח לגביו, אל תנחש):
{
  "heroCards": ["As", "Kh"],
  "board": { "flop": ["Qs", "7d", "2c"], "turn": "9h", "river": null },
  "potSize": 120,
  "heroPosition": "BTN"
}

heroPosition, אם ניתן לזהות, חייב להיות אחד מהערכים: UTG, UTG+1, MP, MP+1, HJ, CO, BTN, SB, BB.
אם התמונה אינה שולחן פוקר, או שלא ניתן לזהות שום דבר בביטחון, החזר אובייקט JSON ריק: {}`;

interface ParseScreenshotRequestBody {
  imageBase64?: string;
  mediaType?: string;
}

const ALLOWED_MEDIA_TYPES = new Set(["image/jpeg", "image/png", "image/gif", "image/webp"]);
const MAX_BASE64_LENGTH = 8_000_000; // ~6MB raw — plenty for a screenshot, caps cost/timeout abuse

function sanitizeCards(cards: unknown, max: number): Card[] | undefined {
  if (!Array.isArray(cards)) return undefined;
  const valid = cards.filter((c): c is Card => typeof c === "string" && CARD_RE.test(c));
  return valid.length > 0 ? valid.slice(0, max) : undefined;
}

function sanitizeCard(card: unknown): Card | undefined {
  return typeof card === "string" && CARD_RE.test(card) ? (card as Card) : undefined;
}

const VALID_POSITIONS = new Set([
  "UTG",
  "UTG+1",
  "MP",
  "MP+1",
  "HJ",
  "CO",
  "BTN",
  "SB",
  "BB",
]);

interface ParsedScreenshot {
  heroCards?: Card[];
  board?: { flop?: Card[]; turn?: Card; river?: Card };
  potSize?: number;
  heroPosition?: string;
}

function sanitizeModelOutput(raw: unknown): ParsedScreenshot {
  if (!raw || typeof raw !== "object") return {};
  const obj = raw as Record<string, unknown>;
  const result: ParsedScreenshot = {};

  const heroCards = sanitizeCards(obj.heroCards, 2);
  if (heroCards) result.heroCards = heroCards;

  if (obj.board && typeof obj.board === "object") {
    const boardObj = obj.board as Record<string, unknown>;
    const flop = sanitizeCards(boardObj.flop, 3);
    const turn = sanitizeCard(boardObj.turn);
    const river = sanitizeCard(boardObj.river);
    if (flop || turn || river) {
      result.board = {
        ...(flop ? { flop } : {}),
        ...(turn ? { turn } : {}),
        ...(river ? { river } : {}),
      };
    }
  }

  if (typeof obj.potSize === "number" && Number.isFinite(obj.potSize) && obj.potSize >= 0) {
    result.potSize = obj.potSize;
  }

  if (typeof obj.heroPosition === "string" && VALID_POSITIONS.has(obj.heroPosition)) {
    result.heroPosition = obj.heroPosition;
  }

  return result;
}

export async function POST(request: NextRequest) {
  try {
    const supabase = createClient();
    const {
      data: { user },
      error,
    } = await supabase.auth.getUser();
    if (error || !user) {
      return NextResponse.json({ error: "יש להתחבר כדי לנתח צילום מסך." }, { status: 401 });
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
      { error: "ניתוח מצילום מסך טרם הוגדר — נדרש מפתח Anthropic API בצד השרת (ANTHROPIC_API_KEY)." },
      { status: 501 }
    );
  }

  let body: ParseScreenshotRequestBody;
  try {
    body = (await request.json()) as ParseScreenshotRequestBody;
  } catch {
    return NextResponse.json({ error: "גוף הבקשה אינו JSON תקין." }, { status: 400 });
  }

  const { imageBase64, mediaType } = body;
  if (!imageBase64 || !mediaType) {
    return NextResponse.json({ error: "יש לספק imageBase64 ו-mediaType." }, { status: 400 });
  }
  if (!ALLOWED_MEDIA_TYPES.has(mediaType)) {
    return NextResponse.json({ error: "סוג קובץ לא נתמך — יש להעלות JPEG, PNG, GIF או WebP." }, { status: 400 });
  }
  if (imageBase64.length > MAX_BASE64_LENGTH) {
    return NextResponse.json({ error: "התמונה גדולה מדי." }, { status: 400 });
  }

  try {
    const client = new Anthropic({ apiKey });
    const response = await client.messages.create({
      model: "claude-opus-4-8",
      max_tokens: 512,
      system: SYSTEM_PROMPT,
      messages: [
        {
          role: "user",
          content: [
            {
              type: "image",
              source: {
                type: "base64",
                media_type: mediaType as "image/jpeg" | "image/png" | "image/gif" | "image/webp",
                data: imageBase64,
              },
            },
            { type: "text", text: "זהה את פרטי היד הגלויים בתמונה, לפי הסכימה שסופקה." },
          ],
        },
      ],
    });

    const textBlock = response.content.find((b) => b.type === "text");
    if (!textBlock || textBlock.type !== "text") {
      return NextResponse.json({ error: "לא התקבלה תשובת טקסט מהמודל." }, { status: 502 });
    }

    const cleaned = textBlock.text.trim().replace(/^```(?:json)?/i, "").replace(/```$/, "").trim();
    let raw: unknown;
    try {
      raw = JSON.parse(cleaned);
    } catch {
      return NextResponse.json({ error: "לא ניתן היה לפענח את תשובת המודל." }, { status: 502 });
    }

    return NextResponse.json(sanitizeModelOutput(raw));
  } catch (err) {
    const message = err instanceof Error ? err.message : "שגיאה לא ידועה";
    return NextResponse.json({ error: `שגיאה בקריאה ל-AI: ${message}` }, { status: 502 });
  }
}
