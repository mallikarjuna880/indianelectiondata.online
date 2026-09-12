import type { UserRole } from '@prisma/client';

const rank: Record<UserRole, number> = {
  DATA_EDITOR: 10,
  ADMIN: 20,
  SUPER_ADMIN: 30,
};

export function can(role: UserRole, minimum: UserRole) {
  return rank[role] >= rank[minimum];
}

export const permissions = {
  upload: 'DATA_EDITOR' as UserRole,
  review: 'ADMIN' as UserRole,
  approve: 'ADMIN' as UserRole,
  publish: 'ADMIN' as UserRole,
  users: 'SUPER_ADMIN' as UserRole,
};
