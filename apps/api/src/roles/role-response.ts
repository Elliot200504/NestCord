import type { ServerRole } from '@nestcord/shared';

/** The columns a `ServerRole` is built from. */
export const ROLE_SELECT = {
  id: true,
  name: true,
  color: true,
  permissions: true,
  position: true,
  isDefault: true,
} as const;

/** The one place a role row becomes a response body. */
export function toServerRole(role: ServerRole): ServerRole {
  return {
    id: role.id,
    name: role.name,
    color: role.color,
    permissions: role.permissions,
    position: role.position,
    isDefault: role.isDefault,
  };
}
