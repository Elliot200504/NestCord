import { Injectable } from '@nestjs/common';

import { MAX_VOICE_PARTICIPANTS, type PublicUser, type VoiceParticipant } from '@nestcord/shared';

/** One person in one voice channel, and the socket carrying their call. */
interface VoiceEntry {
  socketId: string;
  user: PublicUser;
  selfMute: boolean;
  selfDeaf: boolean;
  canSpeak: boolean;
}

/** Where a socket's call is, so a disconnect does not have to search every channel. */
interface SocketLocation {
  channelId: string;
  userId: string;
}

export interface JoinInput {
  channelId: string;
  socketId: string;
  user: PublicUser;
  canSpeak: boolean;
}

/** Why a join was refused, or that it was accepted. */
export type JoinResult = { ok: true } | { ok: false; reason: 'full' };

/**
 * Who is in which voice channel, in memory (PLAN.MD §17).
 *
 * Deliberately not a table, for the same reason as PresenceService: being in a call
 * is a fact about a live socket. A row would survive a restart or a kill and leave
 * ghosts sitting in a channel nobody is in, and the code to reconcile that on boot
 * is more work than the feature. Holding it here means a restart clears every call
 * by construction.
 *
 * The sidebar still shows a call to people who are not in it, because this process
 * serves both the snapshot route and the broadcasts.
 *
 * A user is in at most one voice channel at a time — joining a second one leaves the
 * first, which the caller is expected to broadcast.
 */
@Injectable()
export class VoiceStateService {
  /** channelId -> userId -> entry. */
  private readonly channels = new Map<string, Map<string, VoiceEntry>>();
  /** socketId -> where that socket's call is. */
  private readonly locations = new Map<string, SocketLocation>();

  /**
   * Puts a user in a channel, refusing the one that would exceed the cap.
   *
   * Rejoining a channel the user is already in replaces their entry rather than
   * counting twice — a reconnecting tab must not consume a second seat.
   */
  join({ channelId, socketId, user, canSpeak }: JoinInput): JoinResult {
    const existing = this.channels.get(channelId);
    const isAlreadyHere = existing?.has(user.id) ?? false;

    if (!isAlreadyHere && (existing?.size ?? 0) >= MAX_VOICE_PARTICIPANTS) {
      return { ok: false, reason: 'full' };
    }

    const entry: VoiceEntry = { socketId, user, selfMute: false, selfDeaf: false, canSpeak };
    const participants = existing ?? new Map<string, VoiceEntry>();

    // Drop the previous entry's socket mapping, whether it was in this channel or
    // another one, so no socket id is left pointing at a call it is not in.
    const previous = participants.get(user.id);
    if (previous) this.locations.delete(previous.socketId);

    participants.set(user.id, entry);
    this.channels.set(channelId, participants);
    this.locations.set(socketId, { channelId, userId: user.id });

    return { ok: true };
  }

  /** Removes whatever call this socket was in. Returns it, so the caller can announce it. */
  leaveSocket(socketId: string): SocketLocation | null {
    const location = this.locations.get(socketId);

    if (!location) return null;

    this.locations.delete(socketId);

    // Only clear the entry if it still belongs to this socket: the user may have
    // rejoined from another tab, which already replaced it.
    const participants = this.channels.get(location.channelId);
    const entry = participants?.get(location.userId);

    if (!participants || entry?.socketId !== socketId) return null;

    participants.delete(location.userId);
    if (participants.size === 0) this.channels.delete(location.channelId);

    return location;
  }

  /** Removes a user from whichever channel they are in, whoever asked. */
  leaveUser(userId: string): SocketLocation | null {
    for (const [channelId, participants] of this.channels) {
      const entry = participants.get(userId);

      if (!entry) continue;

      this.locations.delete(entry.socketId);
      participants.delete(userId);
      if (participants.size === 0) this.channels.delete(channelId);

      return { channelId, userId };
    }

    return null;
  }

  /** Records a mute or deafen. Returns the new state, or null if that socket is not in a call. */
  update(socketId: string, next: { selfMute: boolean; selfDeaf: boolean }): VoiceParticipant | null {
    const location = this.locations.get(socketId);
    const entry = location && this.channels.get(location.channelId)?.get(location.userId);

    if (!location || !entry) return null;

    const updated: VoiceEntry = { ...entry, selfMute: next.selfMute, selfDeaf: next.selfDeaf };
    this.channels.get(location.channelId)?.set(location.userId, updated);

    return toParticipant(location.channelId, updated);
  }

  /** Where this socket's call is, as the server recorded it — never as the client claims. */
  locationOf(socketId: string): SocketLocation | null {
    return this.locations.get(socketId) ?? null;
  }

  participantsIn(channelId: string): VoiceParticipant[] {
    const participants = this.channels.get(channelId);

    if (!participants) return [];

    return [...participants.values()].map((entry) => toParticipant(channelId, entry));
  }

  /** Everyone in any of these channels, for the snapshot a client reads on load. */
  participantsFor(channelIds: string[]): VoiceParticipant[] {
    return channelIds.flatMap((channelId) => this.participantsIn(channelId));
  }

  participantIdsIn(channelId: string): string[] {
    return [...(this.channels.get(channelId)?.keys() ?? [])];
  }

  countIn(channelId: string): number {
    return this.channels.get(channelId)?.size ?? 0;
  }

  /** The socket to relay a signal to, or null if that user is not in that channel. */
  socketIdOf(channelId: string, userId: string): string | null {
    return this.channels.get(channelId)?.get(userId)?.socketId ?? null;
  }

  isIn(channelId: string, userId: string): boolean {
    return this.channels.get(channelId)?.has(userId) ?? false;
  }

  /** Every voice channel currently holding a call, for finding one by server. */
  activeChannelIds(): string[] {
    return [...this.channels.keys()];
  }
}

function toParticipant(channelId: string, entry: VoiceEntry): VoiceParticipant {
  return {
    channelId,
    user: entry.user,
    selfMute: entry.selfMute,
    selfDeaf: entry.selfDeaf,
    canSpeak: entry.canSpeak,
  };
}
