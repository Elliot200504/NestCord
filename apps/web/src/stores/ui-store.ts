import { create } from 'zustand';

/**
 * Client-only UI state. Server data belongs in TanStack Query — never here.
 */
interface UiState {
  memberListOpen: boolean;
  channelSidebarOpen: boolean;
  activeModal: 'create-server' | 'create-channel' | null;
  toggleMemberList: () => void;
  toggleChannelSidebar: () => void;
  openModal: (modal: UiState['activeModal']) => void;
  closeModal: () => void;
}

export const useUiStore = create<UiState>((set) => ({
  memberListOpen: true,
  channelSidebarOpen: true,
  activeModal: null,
  toggleMemberList: () => set((state) => ({ memberListOpen: !state.memberListOpen })),
  toggleChannelSidebar: () => set((state) => ({ channelSidebarOpen: !state.channelSidebarOpen })),
  openModal: (activeModal) => set({ activeModal }),
  closeModal: () => set({ activeModal: null }),
}));
