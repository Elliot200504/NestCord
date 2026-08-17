import { create } from 'zustand';

/**
 * Client-only UI state. Server data belongs in TanStack Query — never here.
 */

/** What the composer is answering, once the reader has picked a message to reply to. */
export interface ReplyTarget {
  messageId: string;
  /** The author's display name, for the banner above the composer. */
  author: string;
}

/**
 * Which side panel is overlaying the content on a narrow viewport.
 *
 * One slot rather than a flag per panel: below the shell breakpoint the panels are
 * full-height overlays, so two of them open at once would simply cover each other.
 */
export type Drawer = 'channels' | 'members' | null;

interface UiState {
  /**
   * Whether the member list gets a column of its own. Only consulted on a viewport
   * wide enough to have one — narrow viewports use `drawer` instead.
   */
  memberListOpen: boolean;
  drawer: Drawer;
  activeModal: 'create-server' | 'create-channel' | 'invite' | 'server-settings' | null;
  /**
   * Kept per channel: switching channels mid-reply and coming back should find the
   * reply still pending, and must never point the composer at another channel's
   * message.
   */
  replyTargets: Record<string, ReplyTarget>;
  toggleMemberList: () => void;
  openDrawer: (drawer: NonNullable<Drawer>) => void;
  closeDrawer: () => void;
  openModal: (modal: UiState['activeModal']) => void;
  closeModal: () => void;
  startReply: (channelId: string, target: ReplyTarget) => void;
  cancelReply: (channelId: string) => void;
}

export const useUiStore = create<UiState>((set) => ({
  memberListOpen: true,
  drawer: null,
  activeModal: null,
  replyTargets: {},
  toggleMemberList: () => set((state) => ({ memberListOpen: !state.memberListOpen })),
  openDrawer: (drawer) => set({ drawer }),
  closeDrawer: () => set({ drawer: null }),
  openModal: (activeModal) => set({ activeModal }),
  closeModal: () => set({ activeModal: null }),
  startReply: (channelId, target) =>
    set((state) => ({ replyTargets: { ...state.replyTargets, [channelId]: target } })),
  cancelReply: (channelId) =>
    set((state) => {
      const { [channelId]: _removed, ...rest } = state.replyTargets;

      return { replyTargets: rest };
    }),
}));
