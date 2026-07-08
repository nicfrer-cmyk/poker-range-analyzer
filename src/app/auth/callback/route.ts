import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");

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

  return NextResponse.redirect(origin);
}
