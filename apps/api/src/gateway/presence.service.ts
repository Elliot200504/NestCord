import { Injectable } from '@nestjs/common';

import type { PresenceStatus } from '@nestcord/shared';

/** One user's live connections and the status they chose. */
interface PresenceEntry {
  /** Socket ids. Several because a person can have several tabs open. */
  sockets: Set<string>;
  /** What they picked in the user panel: ONLINE, IDLE, DO_NOT_DISTURB or Invisible. */
  chosen: PresenceStatus;
}

/**
 * Who is online, in memory (PLAN.MD §7).
 *
 * Deliberately not persisted: presence is a fact about live connections, and a
 * restart ends every connection, so a stored value would only ever be a lie. The
 * `User.status` column is a different thing — the status a person *chose*, which is
 * theirs until they change it. Effective presence is the pair: chosen status while
 * they have a socket, OFFLINE once the last one goes.
 *
 * A user who picked Invisible reads as OFFLINE to everyone else while still being
 * connected, which is the whole point of the setting.
 */
@Injectable()
export class PresenceService {
  private readonly entries = new Map<string, PresenceEntry>();

  /**
   * Records a new connection. Returns true when this is the user's first socket —
   * the only case worth telling anyone about, since a second tab changes nothing.
   */
  connect(userId: string, socketId: string, chosen: PresenceStatus): boolean {
    const entry = this.entries.get(userId);

    if (!entry) {
      this.entries.set(userId, { sockets: new Set([socketId]), chosen });

      return true;
    }

    entry.sockets.add(socketId);
    // A fresh connection carries the current choice, which may have changed in
    // another tab since this one connected.
    entry.chosen = chosen;

    return false;
  }

  /** Returns true when that was the user's last socket, so they are now offline. */
  disconnect(userId: string, socketId: string): boolean {
    const entry = this.entries.get(userId);

    if (!entry) return false;

    entry.sockets.delete(socketId);

    if (entry.sockets.size > 0) return false;

    this.entries.delete(userId);

    return true;
  }

  /** Records a status the user picked, for as long as they stay connected. */
  choose(userId: string, chosen: PresenceStatus): void {
    const entry = this.entries.get(userId);

    if (entry) entry.chosen = chosen;
  }

  /**
   * What everyone else should see. Someone with no live socket is OFFLINE whatever
   * they chose, and so is someone who chose to be invisible.
   */
  statusOf(userId: string): PresenceStatus {
    const entry = this.entries.get(userId);

    if (!entry || entry.sockets.size === 0) return 'OFFLINE';

    return entry.chosen;
  }

  /** Effective status for a batch of users, for filling in a member list. */
  statusFor(userIds: string[]): Map<string, PresenceStatus> {
    return new Map(userIds.map((userId) => [userId, this.statusOf(userId)]));
  }

  isOnline(userId: string): boolean {
    return this.statusOf(userId) !== 'OFFLINE';
  }

  /** Every user with at least one live socket, whatever they chose to appear as. */
  connectedUserIds(): string[] {
    return [...this.entries.keys()];
  }
}
