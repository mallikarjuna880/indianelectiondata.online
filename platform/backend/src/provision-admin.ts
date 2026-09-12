import { hashPassword } from './auth.js';
import { prisma } from './db.js';

const email = process.env.ADMIN_EMAIL?.trim().toLowerCase();
const password = process.env.ADMIN_PASSWORD;
const role = (process.env.ADMIN_ROLE || 'SUPER_ADMIN') as 'SUPER_ADMIN' | 'ADMIN' | 'DATA_EDITOR';

if (!email || !password) throw new Error('Set ADMIN_EMAIL and ADMIN_PASSWORD before running this script');
if (password.length < 12) throw new Error('ADMIN_PASSWORD must be at least 12 characters');
if (!['SUPER_ADMIN', 'ADMIN', 'DATA_EDITOR'].includes(role)) throw new Error('Invalid ADMIN_ROLE');

const passwordHash = await hashPassword(password);
const user = await prisma.user.upsert({
  where: { email },
  create: { email, passwordHash, role, active: true },
  update: { passwordHash, role, active: true }
});
console.log(`Admin provisioned: ${user.email} (${user.role})`);
await prisma.$disconnect();
