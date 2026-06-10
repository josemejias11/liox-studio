import { PrismaClient } from "../generated/prisma";

const globalForPrisma = globalThis as unknown as { prisma: PrismaClient };

export const prisma =
  globalForPrisma.prisma ?? new PrismaClient({ log: ["error"] });

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;

// Configure SQLite to run with WAL mode and busy_timeout to handle concurrent progress writes better.
prisma.$executeRawUnsafe("PRAGMA journal_mode = WAL;").catch(console.error);
prisma.$executeRawUnsafe("PRAGMA busy_timeout = 5000;").catch(console.error);

