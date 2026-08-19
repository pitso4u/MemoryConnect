import { PrismaClient } from "../../../../generated/prisma";

export const prisma = new PrismaClient();

export async function disconnect() {
  await prisma.$disconnect();
}
