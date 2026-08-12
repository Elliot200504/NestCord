import { beforeEach, describe, expect, it } from 'vitest';

import { PresenceService } from './presence.service';

const ADA = 'user-ada';

describe('PresenceService', () => {
  let presence: PresenceService;

  beforeEach(() => {
    presence = new PresenceService();
  });

  it('reports a user with no connection as offline', () => {
    expect(presence.statusOf(ADA)).toBe('OFFLINE');
  });

  it('reports the chosen status once connected', () => {
    presence.connect(ADA, 'socket-1', 'ONLINE');

    expect(presence.statusOf(ADA)).toBe('ONLINE');
  });

  it('treats the first socket as news and a second tab as nothing', () => {
    expect(presence.connect(ADA, 'socket-1', 'ONLINE')).toBe(true);
    expect(presence.connect(ADA, 'socket-2', 'ONLINE')).toBe(false);
  });

  it('stays online while any tab is left open', () => {
    presence.connect(ADA, 'socket-1', 'ONLINE');
    presence.connect(ADA, 'socket-2', 'ONLINE');

    expect(presence.disconnect(ADA, 'socket-1')).toBe(false);
    expect(presence.statusOf(ADA)).toBe('ONLINE');
  });

  it('goes offline when the last socket closes', () => {
    presence.connect(ADA, 'socket-1', 'ONLINE');

    expect(presence.disconnect(ADA, 'socket-1')).toBe(true);
    expect(presence.statusOf(ADA)).toBe('OFFLINE');
  });

  it('ignores a disconnect it never saw connect', () => {
    expect(presence.disconnect('user-ghost', 'socket-9')).toBe(false);
  });

  it('shows someone who chose Invisible as offline while they are connected', () => {
    // Invisible is a chosen OFFLINE, which is what makes the setting work.
    presence.connect(ADA, 'socket-1', 'OFFLINE');

    expect(presence.statusOf(ADA)).toBe('OFFLINE');
    expect(presence.connectedUserIds()).toEqual([ADA]);
  });

  it('follows a status the user picks while connected', () => {
    presence.connect(ADA, 'socket-1', 'ONLINE');

    presence.choose(ADA, 'DO_NOT_DISTURB');

    expect(presence.statusOf(ADA)).toBe('DO_NOT_DISTURB');
  });

  it('does not resurrect a disconnected user by picking a status', () => {
    presence.choose(ADA, 'ONLINE');

    expect(presence.statusOf(ADA)).toBe('OFFLINE');
  });

  it('takes the newest choice from a reconnecting tab', () => {
    presence.connect(ADA, 'socket-1', 'ONLINE');
    presence.connect(ADA, 'socket-2', 'IDLE');

    expect(presence.statusOf(ADA)).toBe('IDLE');
  });

  it('resolves a batch for a member list', () => {
    presence.connect(ADA, 'socket-1', 'ONLINE');

    expect(presence.statusFor([ADA, 'user-grace'])).toEqual(
      new Map([
        [ADA, 'ONLINE'],
        ['user-grace', 'OFFLINE'],
      ]),
    );
  });
});
