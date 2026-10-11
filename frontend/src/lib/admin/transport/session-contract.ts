export interface AdminSessionContext {
  user: { id: string; email: string; role: string; permissions: string[] };
}
export function parseAdminSessionContext(
  value: unknown,
): AdminSessionContext | null {
  if (!value || typeof value !== 'object' || !('user' in value)) return null;
  const user = value.user;
  if (
    !user ||
    typeof user !== 'object' ||
    !('id' in user) ||
    !('email' in user) ||
    !('role' in user) ||
    !('permissions' in user)
  )
    return null;
  if (
    typeof user.id !== 'string' ||
    typeof user.email !== 'string' ||
    typeof user.role !== 'string' ||
    !Array.isArray(user.permissions) ||
    !user.permissions.every(
      (permission): permission is string => typeof permission === 'string',
    )
  )
    return null;
  return {
    user: {
      id: user.id,
      email: user.email,
      role: user.role,
      permissions: [...user.permissions],
    },
  };
}
