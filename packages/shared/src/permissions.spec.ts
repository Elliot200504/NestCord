import { describe, expect, it } from 'vitest';

import {
  ALL_PERMISSIONS,
  DEFAULT_EVERYONE_PERMISSIONS,
  Permission,
  has,
  resolvePermissions,
} from './permissions.js';

describe('resolvePermissions', () => {
  it('grants everything to the server owner', () => {
    expect(resolvePermissions({ isOwner: true, roleBits: [] })).toBe(ALL_PERMISSIONS);
  });

  it('unions the bits of every role the member has', () => {
    const bits = resolvePermissions({
      isOwner: false,
      roleBits: [Permission.VIEW_CHANNEL, Permission.SEND_MESSAGES],
    });

    expect(has(bits, Permission.VIEW_CHANNEL)).toBe(true);
    expect(has(bits, Permission.SEND_MESSAGES)).toBe(true);
    expect(has(bits, Permission.MANAGE_MESSAGES)).toBe(false);
  });

  it('lets ADMINISTRATOR bypass an explicit channel deny', () => {
    const bits = resolvePermissions({
      isOwner: false,
      roleBits: [Permission.ADMINISTRATOR],
      overrides: [{ type: 'role', allow: 0, deny: Permission.SEND_MESSAGES }],
    });

    expect(bits).toBe(ALL_PERMISSIONS);
    expect(has(bits, Permission.SEND_MESSAGES)).toBe(true);
  });

  it('applies a role deny over the base permissions', () => {
    const bits = resolvePermissions({
      isOwner: false,
      roleBits: [DEFAULT_EVERYONE_PERMISSIONS],
      overrides: [{ type: 'role', allow: 0, deny: Permission.SEND_MESSAGES }],
    });

    expect(has(bits, Permission.VIEW_CHANNEL)).toBe(true);
    expect(has(bits, Permission.SEND_MESSAGES)).toBe(false);
  });

  it('lets a member override win over a role deny', () => {
    const bits = resolvePermissions({
      isOwner: false,
      roleBits: [DEFAULT_EVERYONE_PERMISSIONS],
      overrides: [
        { type: 'role', allow: 0, deny: Permission.SEND_MESSAGES },
        { type: 'member', allow: Permission.SEND_MESSAGES, deny: 0 },
      ],
    });

    expect(has(bits, Permission.SEND_MESSAGES)).toBe(true);
  });

  it('clears every permission when VIEW_CHANNEL is denied', () => {
    const bits = resolvePermissions({
      isOwner: false,
      roleBits: [DEFAULT_EVERYONE_PERMISSIONS],
      overrides: [{ type: 'everyone', allow: 0, deny: Permission.VIEW_CHANNEL }],
    });

    expect(bits).toBe(0);
    expect(has(bits, Permission.SEND_MESSAGES)).toBe(false);
  });
});
