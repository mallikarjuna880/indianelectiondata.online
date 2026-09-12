import crypto from 'node:crypto';
import type { FastifyReply, FastifyRequest } from 'fastify';
import { prisma } from './db.js';
import { createSessionToken, hashSessionToken, verifyPassword } from './auth.js';

const SESSION_DAYS = Number(process.env.SESSION_DAYS || 7);
const COOKIE_NAME = process.env.SESSION_COOKIE_NAME || 'ied_admin_session';

export type AdminUser = { id: string; email: string; role: 'SUPER_ADMIN' | 'ADMIN' | 'DATA_EDITOR' };

export async function login(email: string, password: string, reply: FastifyReply) {
  const user = await prisma.user.findUnique({ where: { email: email.trim().toLowerCase() } });
  if (!user?.active || !user.passwordHash || !(await verifyPassword(user.passwordHash, password))) return false;

  const token = createSessionToken();
  const tokenHash = hashSessionToken(token);
  const expiresAt = new Date(Date.now() + SESSION_DAYS * 86400000);
  await prisma.session.create({ data: { userId: user.id, tokenHash, expiresAt } });
  reply.setCookie(COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    path: '/api/v1/admin',
    expires: expiresAt
  });
  return true;
}

export async function getAdminUser(request: FastifyRequest): Promise<AdminUser | null> {
  const token = request.cookies[COOKIE_NAME];
  if (!token) return null;
  const session = await prisma.session.findUnique({
    where: { tokenHash: hashSessionToken(token) },
    include: { user: true }
  });
  if (!session || session.expiresAt <= new Date() || !session.user.active) return null;
  return { id: session.user.id, email: session.user.email, role: session.user.role };
}

export async function requireAdmin(request: FastifyRequest, reply: FastifyReply, roles?: AdminUser['role'][]) {
  const user = await getAdminUser(request);
  if (!user) { await reply.code(401).send({ error: 'UNAUTHENTICATED' }); return null; }
  if (roles && !roles.includes(user.role)) { await reply.code(403).send({ error: 'FORBIDDEN' }); return null; }
  return user;
}

export async function logout(request: FastifyRequest, reply: FastifyReply) {
  const token = request.cookies[COOKIE_NAME];
  if (token) await prisma.session.deleteMany({ where: { tokenHash: hashSessionToken(token) } });
  reply.clearCookie(COOKIE_NAME, { path: '/api/v1/admin' });
}

export function requestId() { return crypto.randomUUID(); }
