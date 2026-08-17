import type { ServerMember } from '@nestcord/shared';

/**
 * What to call a member here: their nickname in this server, else their display
 * name, else the username everybody has.
 */
export function memberName(member: ServerMember): string {
  return member.nickname ?? member.user.displayName ?? member.user.username;
}
