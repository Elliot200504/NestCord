import { create } from 'zustand';

import { TYPING_TIMEOUT_MS, type PublicUser } from '@nestcord/shared';

/** One person typing, and when we last heard so. */
interface TypingEntry {
  user: PublicUser;
  /** Epoch ms of the last `typing:start`, for expiring the indicator locally. */
  at: number;
}

interface TypingState {
  /** Keyed by channel, then by user id. */
  byChannel: Record<string, Record<string, TypingEntry>>;
  start: (channelId: string, user: PublicUser, at: number) => void;
  stop: (channelId: string, userId: string) => void;
  /** Drops entries older than the timeout. Called on a tick by the indicator. */
  prune: (now: number) => void;
  clear: () => void;
}

/**
 * Who is typing where — ephemeral UI state, never server data, so it lives here
 * rather than in the query cache.
 *
 * Entries expire on a timer rather than waiting for `typing:stop`, because a closed
 * tab or a dropped connection never sends one.
 */
export const useTypingStore = create<TypingState>((set) => ({
  byChannel: {},

  start: (channelId, user, at) =>
    set((state) => ({
      byChannel: {
        ...state.byChannel,
        [channelId]: { ...state.byChannel[channelId], [user.id]: { user, at } },
      },
    })),

  stop: (channelId, userId) =>
    set((state) => {
      const channel = state.byChannel[channelId];

      if (!channel?.[userId]) return state;

      const { [userId]: _stopped, ...rest } = channel;

      return { byChannel: { ...state.byChannel, [channelId]: rest } };
    }),

  prune: (now) =>
    set((state) => {
      const byChannel = Object.fromEntries(
        Object.entries(state.byChannel).map(([channelId, entries]) => [
          channelId,
          Object.fromEntries(
            Object.entries(entries).filter(([, entry]) => now - entry.at < TYPING_TIMEOUT_MS),
          ),
        ]),
      );

      return { byChannel };
    }),

  clear: () => set({ byChannel: {} }),
}));

/** The people typing in a channel right now, excluding yourself. */
export function typingIn(
  byChannel: TypingState['byChannel'],
  channelId: string,
  viewerId: string,
  now: number,
): PublicUser[] {
  return Object.values(byChannel[channelId] ?? {})
    .filter((entry) => entry.user.id !== viewerId && now - entry.at < TYPING_TIMEOUT_MS)
    .map((entry) => entry.user);
}
