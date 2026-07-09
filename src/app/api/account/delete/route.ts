// ---------------------------------------------------------------------------
// POST /api/account/delete
//
// Self-service account deletion. Requires a signed-in user (cookie-based
// Supabase session). Deletes every DB row owned by the user in FK-safe
// order inside one Prisma transaction, then deletes the Supabase Auth user
// itself via the service-role admin client (src/lib/supabase/admin.ts) —
// that last step is why this needs SUPABASE_SERVICE_ROLE_KEY; without it,
// this route returns a clear 501 rather than silently leaving a dangling
// Auth user with no app data.
// ---------------------------------------------------------------------------

import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient, SupabaseAdminNotConfiguredError } from "@/lib/supabase/admin";
import { prisma } from "@/lib/prisma";

export async function POST() {
  let userId: string;
  try {
    const supabase = await createClient();
    const {
      data: { user },
      error,
    } = await supabase.auth.getUser();

    if (error || !user) {
      return NextResponse.json({ error: "יש להתחבר כדי למחוק את החשבון." }, { status: 401 });
    }
    userId = user.id;
  } catch (err) {
    if (err instanceof Error && err.message.startsWith("Supabase is not configured")) {
      return NextResponse.json({ error: err.message }, { status: 501 });
    }
    throw err;
  }

  let admin;
  try {
    admin = createAdminClient();
  } catch (err) {
    if (err instanceof SupabaseAdminNotConfiguredError) {
      return NextResponse.json(
        { error: "מחיקת חשבון עדיין לא זמינה בסביבה זו (חסרה הגדרת שרת). פנה/י לתמיכה." },
        { status: 501 }
      );
    }
    throw err;
  }

  try {
    await prisma.$transaction([
      prisma.hand.deleteMany({ where: { userId } }),
      prisma.range.deleteMany({ where: { userId } }),
      prisma.session.deleteMany({ where: { userId } }),
      prisma.opponent.deleteMany({ where: { userId } }),
      prisma.subscription.deleteMany({ where: { userId } }),
      prisma.aiUsageDaily.deleteMany({ where: { userId } }),
      prisma.user.delete({ where: { id: userId } }),
    ]);
  } catch (err) {
    console.error("Account deletion: failed to delete DB rows for user", userId, err);
    return NextResponse.json(
      { error: "מחיקת נתוני החשבון נכשלה. נסה/י שוב או פנה/י לתמיכה." },
      { status: 500 }
    );
  }

  const { error: authDeleteError } = await admin.auth.admin.deleteUser(userId);
  if (authDeleteError) {
    console.error(
      "Account deletion: DB rows removed but Supabase Auth user deletion failed",
      userId,
      authDeleteError
    );
    return NextResponse.json(
      {
        error:
          "נתוני החשבון נמחקו, אך מחיקת פרטי ההתחברות נכשלה. פנה/י לתמיכה כדי לסיים את התהליך.",
      },
      { status: 500 }
    );
  }

  return NextResponse.json({ deleted: true });
}
