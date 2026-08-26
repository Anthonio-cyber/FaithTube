import { PrismaClient } from '@prisma/client';
import { env, isProd } from '../config/env.js';

export const prisma = new PrismaClient({
  log: isProd ? ['error', 'warn'] : ['error', 'warn'],
  datasources: { db: { url: env.DATABASE_URL } },
});

export async function disconnect() {
  await prisma.$disconnect();
}
