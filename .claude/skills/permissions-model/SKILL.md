---
name: permissions-model
description: NestCord's Discord-style permission system — flags, bitfield storage, resolution order, role hierarchy, channel overrides. Use when adding a permission check, a role feature, or any moderation action.
---

# Permission Model

The single most security-sensitive part of this codebase. Implement it **once**, in shared code, and
use that one implementation from both the HTTP guard and the Socket.IO gateway.

## Flags

Defined once in `packages/shared` as a bitfield:

```ts
export const Permission = {
  VIEW_CHANNEL:     1 << 0,
  SEND_MESSAGES:    1 << 1,
  MANAGE_MESSAGES:  1 << 2,
  ATTACH_FILES:     1 << 3,
  ADD_REACTIONS:    1 << 4,
  CONNECT:          1 << 5,
  SPEAK:            1 << 6,
  MANAGE_CHANNELS:  1 << 7,
  MANAGE_SERVER:    1 << 8,
  MANAGE_ROLES:     1 << 9,
  KICK_MEMBERS:     1 << 10,
  BAN_MEMBERS:      1 << 11,
  ADMINISTRATOR:    1 << 12,
} as const;

export type PermissionFlag = (typeof Permission)[keyof typeof Permission];
```

Stored as an integer on `Role.permissions`. Channel overrides store an `allow` and a `deny` bitfield
per role or member.

## Resolution order

```text
1. Is the user the server owner?            -> all permissions, done
2. base = union of all their roles' bits, including @everyone
3. Does base include ADMINISTRATOR?         -> all permissions, done
4. Apply channel overrides in order:
     a. @everyone role override: deny, then allow
     b. other role overrides:    accumulated deny, then accumulated allow
     c. member-specific override: deny, then allow
5. VIEW_CHANNEL denied -> every other permission in that channel is irrelevant
```

Step 5 matters: a user who cannot see a channel cannot send to it, react in it, or receive its socket
events, regardless of other bits.

```ts
export function resolvePermissions(input: {
  isOwner: boolean;
  roleBits: number[];
  overrides: { type: 'everyone' | 'role' | 'member'; allow: number; deny: number }[];
}): number {
  if (input.isOwner) return ALL_PERMISSIONS;
  const base = input.roleBits.reduce((acc, bits) => acc | bits, 0);
  if (base & Permission.ADMINISTRATOR) return ALL_PERMISSIONS;
  // apply overrides in the order above
  return applied;
}

export const has = (bits: number, flag: PermissionFlag) =>
  (bits & Permission.ADMINISTRATOR) !== 0 || (bits & flag) !== 0;
```

## Role hierarchy

`Role.position` orders roles; higher position wins.

- A member may only create, edit, delete, or assign roles **below** their own highest position.
- A member may not kick, ban, or manage a member whose highest role position is greater than or equal
  to their own.
- The server owner is above everyone, always.
- `@everyone` is position 0 and cannot be deleted or reordered.

## Where checks go

| Layer                  | Responsibility                                                       |
| ---------------------- | -------------------------------------------------------------------- |
| React                  | Show/hide UI only. Cosmetic. Never trusted.                           |
| NestJS `PermissionGuard` | Authoritative check on every server/channel route                    |
| Socket.IO gateway      | Same check before joining a room and before handling any event        |
| Service                | Ownership rules (only the author edits their own message)             |

## Common mistakes to look for

- Checking membership but not the specific permission
- Forgetting `ADMINISTRATOR` bypass, or applying it *after* the deny overrides
- Applying member overrides before role overrides
- A gateway event that skips the guard entirely
- Letting a moderator act on someone at an equal role position
- A second copy of resolution logic in the web app that the API does not mirror

## Tests worth writing

`@everyone` only; role union; `ADMINISTRATOR` beats an explicit deny; channel deny beats role allow;
member allow beats role deny; `VIEW_CHANNEL` denied hides the channel entirely; equal-position kick is
rejected; owner can do everything.
