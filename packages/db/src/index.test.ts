import { PrismaClient } from '@prisma/client';

process.env.SUPABASE_URL = 'https://test.supabase.co';
process.env.SUPABASE_SERVICE_KEY = 'test-key';
process.env.WAHA_BASE_URL = 'http://localhost:3001';
process.env.WAHA_API_KEY = 'test-waha-key';
process.env.STRIPE_SECRET_KEY = 'sk_test_xxx';
process.env.STRIPE_WEBHOOK_SECRET = 'whsec_xxx';
process.env.STRIPE_PRO_PRICE_ID = 'price_test';
process.env.RESEND_API_KEY = 're_test';
process.env.RESEND_FROM = 'test@flowdesk.com';
process.env.FRONTEND_URL = 'http://localhost:5173';
process.env.NODE_ENV = 'test';
process.env.PORT = '3333'

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === 'test' ? [] : ['query'],
  });

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma;

export const connectDb = async (): Promise<string> => {
  try {
    await prisma.$connect();
    return "Database connected successfully";
  } catch (error) {
    console.error('Database connection failed:', error);
    throw error;
  }
};