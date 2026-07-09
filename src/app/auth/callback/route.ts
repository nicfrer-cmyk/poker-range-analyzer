import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";

/** Only ever follow a same-origin relative path from `?next=` — mirrors
 *  `login/page.tsx`'s `safeNextPath` (open-redirect protection). */
function safeNextPath(next: string | null): string {
  if (!next) return "/";
  if (!next.startsWith("/")) return "/";
  if (next.startsWith("//")) return "/";
  if (next.includes("://")) return "/";
  if (next.includes("\\")) return "/";
  return next;
}

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = safeNextPath(searchParams.get("next"));

  if (code) {
    try {
      const supabase = await createClient();
      await supabase.auth.exchangeCodeForSession(code);
    } catch {
      return NextResponse.redirect(
        `${origin}/login?error=${encodeURIComponent("לא הצלחנו להשלים את ההתחברות. נסה שוב.")}`
      );
    }
  }

  return NextResponse.redirect(`${origin}${next}`);
}
