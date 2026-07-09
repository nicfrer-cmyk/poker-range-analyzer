// ---------------------------------------------------------------------------
// Manual plan-upgrade fallback, for use until the Grow webhook is verified
// against a real sandbox account (see src/app/api/grow/webhook/route.ts).
//
// Usage:
//   node scripts/set-plan.mjs <email-or-userId> <FREE|PRO> --yes
//
// Reads DATABASE_URL the same way Prisma does (from the environment, or a
// `.env`/`.env.local` file loaded by your shell) — no separate config.
// ---------------------------------------------------------------------------

import { PrismaClient } from "@prisma/client";

function parseArgs(argv) {
  const positional = argv.filter((a) => !a.startsWith("--"));
  const confirmed = argv.includes("--yes");
  const [identifier, plan] = positional;
  return { identifier, plan, confirmed };
}

async function main() {
  const { identifier, plan, confirmed } = parseArgs(process.argv.slice(2));

  if (!identifier || !plan) {
    console.error("Usage: node scripts/set-plan.mjs <email-or-userId> <FREE|PRO> --yes");
    process.exit(1);
  }

  if (plan !== "FREE" && plan !== "PRO") {
    console.error(`Invalid plan "${plan}" — must be exactly "FREE" or "PRO".`);
    process.exit(1);
  }

  if (!confirmed) {
    console.error("Refusing to modify a user's plan without --yes. Re-run with --yes to confirm.");
    process.exit(1);
  }

  const prisma = new PrismaClient();

  try {
    const isEmail = identifier.includes("@");
    const user = await prisma.user.findUnique({
      where: isEmail ? { email: identifier } : { id: identifier },
    });

    if (!user) {
      console.error(`No user found for ${isEmail ? "email" : "id"} "${identifier}".`);
      process.exit(1);
    }

    console.log(`Before: ${user.email} (${user.id}) — plan = ${user.plan}`);

    const updated = await prisma.user.update({
      where: { id: user.id },
      data: { plan },
    });

    console.log(`After:  ${updated.email} (${updated.id}) — plan = ${updated.plan}`);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
