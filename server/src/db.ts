import { PrismaClient } from '@prisma/client'

// Single shared Prisma Client instance for the whole process (tsx watch can
// otherwise create a fresh client — and a fresh connection pool — on every
// hot reload).
declare global {
  // eslint-disable-next-line no-var
  var __prisma: PrismaClient | undefined
}

export const prisma = globalThis.__prisma ?? new PrismaClient()

if (process.env.NODE_ENV !== 'production') {
  globalThis.__prisma = prisma
}
