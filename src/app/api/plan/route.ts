// ---------------------------------------------------------------------------
// GET /api/plan
//
// Returns the signed-in user's real plan ({ plan: "FREE" | "PRO" }), read from
// the same `users.plan` column the Grow webhook writes on a real payment and
// `src/lib/aiUsage.ts` already trusts for server-side AI-quota enforcement.
//
// This is what `src/lib/usePlan.ts` calls so client-side feature gating
// reflects a user's *real* subscription instead of a locally-editable flag.
// Unauthenticated or unconfigured-Supabase requests get "FREE" rather than an
// error — every caller of this route only uses the result to decide what to
// show, never as the enforcement point for anything costly (see usePlan.ts).
// ---------------------------------------------------------------------------

import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { prisma } from "@/lib/prisma";
import type { Plan } from "@/lib/plan";

export async function GET() {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ plan: "FREE" satisfies Plan });
    }

    const dbUser = await prisma.user.findUnique({ where: { id: user.id }, select: { plan: true } });
    const plan: Plan = dbUser?.plan === "PRO" ? "PRO" : "FREE";
    return NextResponse.json({ plan });
  } catch {
    return NextResponse.json({ plan: "FREE" satisfies Plan });
  }
}
