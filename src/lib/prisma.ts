// ---------------------------------------------------------------------------
// Prisma Client singleton
//
// Standard Next.js pattern: reuse one PrismaClient across hot reloads in
// development (each `next dev` recompile would otherwise open a new DB
// connection pool), while creating a fresh instance per server in
// production.
//
// LOCAL-ONLY NOTE: this will throw at first query (not at import time) until
// `DATABASE_URL` is set and `npx prisma migrate dev` / `npx prisma generate`
// have been run — see `.env.example` and `prisma/schema.prisma`.
// ---------------------------------------------------------------------------

import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

export const prisma: PrismaClient =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["error", "warn"] : ["error"],
  });

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
