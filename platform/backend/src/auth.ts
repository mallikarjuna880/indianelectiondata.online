import argon2 from 'argon2';
import crypto from 'node:crypto';

export async function hashPassword(password: string) {
  return argon2.hash(password, { type: argon2.argon2id });
}

export async function verifyPassword(hash: string, password: string) {
  return argon2.verify(hash, password);
}

export function createSessionToken() {
  return crypto.randomBytes(32).toString('base64url');
}

export function hashSessionToken(token: string) {
  return crypto.createHash('sha256').update(token).digest('hex');
}

// Store only the hash in PostgreSQL. Send the raw token only as a
// Secure + HttpOnly + SameSite cookie. Never expose it in frontend code.
