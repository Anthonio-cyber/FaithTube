export const ROLES = ['VIEWER', 'CREATOR', 'MODERATOR', 'ADMIN', 'SUPER_ADMIN'] as const;
export type Role = (typeof ROLES)[number];

/** Higher rank implies every capability of the ranks below it. */
export const ROLE_RANK: Record<Role, number> = {
  VIEWER: 0,
  CREATOR: 1,
  MODERATOR: 2,
  ADMIN: 3,
  SUPER_ADMIN: 4,
};

export function hasRole(role: Role | undefined | null, required: Role): boolean {
  if (!role) return false;
  return ROLE_RANK[role] >= ROLE_RANK[required];
}

/**
 * Fine-grained permissions. Role rank alone is not enough: a moderator must not
 * be able to touch billing, and only a super admin may change roles.
 */
export const PERMISSIONS = [
  'video:upload',
  'video:moderate',
  'comment:moderate',
  'report:review',
  'appeal:review',
  'user:suspend',
  'user:manage',
  'role:assign',
  'billing:manage',
  'settings:manage',
  'audit:read',
  'featured:manage',
  'category:manage',
  'announcement:publish',
] as const;
export type Permission = (typeof PERMISSIONS)[number];

const MODERATOR_PERMISSIONS: Permission[] = [
  'video:moderate',
  'comment:moderate',
  'report:review',
  'appeal:review',
  'user:suspend',
  'audit:read',
];

const ADMIN_PERMISSIONS: Permission[] = [
  ...MODERATOR_PERMISSIONS,
  'user:manage',
  'settings:manage',
  'featured:manage',
  'category:manage',
  'announcement:publish',
];

export const ROLE_PERMISSIONS: Record<Role, Permission[]> = {
  VIEWER: [],
  CREATOR: ['video:upload'],
  MODERATOR: ['video:upload', ...MODERATOR_PERMISSIONS],
  ADMIN: ['video:upload', ...ADMIN_PERMISSIONS],
  SUPER_ADMIN: ['video:upload', ...ADMIN_PERMISSIONS, 'billing:manage', 'role:assign'],
};

export function can(role: Role | undefined | null, permission: Permission): boolean {
  if (!role) return false;
  return ROLE_PERMISSIONS[role].includes(permission);
}
