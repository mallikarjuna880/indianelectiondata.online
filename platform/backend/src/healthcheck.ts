import { prisma } from './db.js';

export async function databaseHealth() {
  await prisma.$queryRaw`SELECT 1`;
  return { database: 'ok' as const };
}
