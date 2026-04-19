import { PrismaClient } from '@prisma/client';

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: ['query'],
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

export { PrismaClient } from '@prisma/client';
