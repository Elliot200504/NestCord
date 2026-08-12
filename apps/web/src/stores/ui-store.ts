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

interface UiState {
  memberListOpen: boolean;
  channelSidebarOpen: boolean;
  activeModal: 'create-server' | 'create-channel' | 'invite' | 'server-settings' | null;
  /**
   * Kept per channel: switching channels mid-reply and coming back should find the
   * reply still pending, and must never point the composer at another channel's
   * message.
   */
  replyTargets: Record<string, ReplyTarget>;
  toggleMemberList: () => void;
  toggleChannelSidebar: () => void;
  openModal: (modal: UiState['activeModal']) => void;
  closeModal: () => void;
  startReply: (channelId: string, target: ReplyTarget) => void;
  cancelReply: (channelId: string) => void;
}

export const useUiStore = create<UiState>((set) => ({
  memberListOpen: true,
  channelSidebarOpen: true,
  activeModal: null,
  replyTargets: {},
  toggleMemberList: () => set((state) => ({ memberListOpen: !state.memberListOpen })),
  toggleChannelSidebar: () => set((state) => ({ channelSidebarOpen: !state.channelSidebarOpen })),
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
