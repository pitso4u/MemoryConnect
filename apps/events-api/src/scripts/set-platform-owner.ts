import '../lib/env';
import { prisma } from '../lib/prisma';

async function main() {
  const [, , action, emailInput] = process.argv;
  const email = emailInput?.trim().toLowerCase();
  if (!['grant', 'revoke'].includes(action) || !email) {
    throw new Error('Usage: npm run platform-owner -- <grant|revoke> <existing-user-email>');
  }
  const user = await prisma.user.findUnique({ where: { email }, include: { organiser: true } });
  if (!user) throw new Error(`No Events account exists for ${email}. Create the account first, then grant owner access.`);
  const role = action === 'grant' ? 'SUPER_ADMIN' : 'ORGANISER';
  await prisma.user.update({ where: { id: user.id }, data: { role } });
  console.log(`${email} is now ${role} for Events Connect (${user.organiser.name}).`);
}

main().catch((error) => { console.error(error instanceof Error ? error.message : error); process.exitCode = 1; })
  .finally(async () => prisma.$disconnect());
