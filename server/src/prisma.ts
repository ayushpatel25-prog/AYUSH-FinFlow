import { PrismaClient } from '@prisma/client';

export const DEFAULT_NEON_DATABASE_URL =
  'postgresql://neondb_owner:npg_dKNBhjz4Me0m@ep-billowing-tree-b45dtxzq-pooler.c-6.us-east-2.aws.neon.tech/neondb?sslmode=require&channel_binding=require';

// Ensure persistent cloud database is used even if Render environment is unset or set to ephemeral SQLite
if (!process.env.DATABASE_URL || process.env.DATABASE_URL.startsWith('file:') || process.env.DATABASE_URL.includes('dev.db')) {
  if (process.env.USE_LOCAL_SQLITE !== 'true') {
    process.env.DATABASE_URL = DEFAULT_NEON_DATABASE_URL;
  }
}

const activeUrl = process.env.DATABASE_URL || DEFAULT_NEON_DATABASE_URL;

const prisma = new PrismaClient({
  datasources: {
    db: {
      url: activeUrl,
    },
  },
  log: process.env.NODE_ENV === 'development' ? ['warn', 'error'] : ['error'],
});

export default prisma;
