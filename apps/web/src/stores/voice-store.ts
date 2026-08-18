import { create } from 'zustand';

/** How the local call is going. */
export type VoiceStatus = 'idle' | 'connecting' | 'connected' | 'error';

/** How one peer connection is going, as the tray reports it. */
export type PeerStatus = 'connecting' | 'connected' | 'failed';

export interface PeerEntry {
  /** Their audio, once it arrives. Not serialisable, which is why it stays out of the query cache. */
  stream: MediaStream | null;
  status: PeerStatus;
}

interface VoiceState {
  /** The channel *this* client is in, or null when not in a call. */
  channelId: string | null;
  status: VoiceStatus;
  /** Something a person can read: mic denied, channel full, connection lost. */
  errorMessage: string | null;
  selfMute: boolean;
  selfDeaf: boolean;
  peers: Record<string, PeerEntry>;
  connecting: (channelId: string) => void;
  connected: () => void;
  failed: (message: string) => void;
  left: () => void;
  setSelf: (next: { selfMute: boolean; selfDeaf: boolean }) => void;
  setPeer: (userId: string, entry: Partial<PeerEntry>) => void;
  dropPeer: (userId: string) => void;
}

/**
 * The local side of a call — which channel *I* am in, whether *my* microphone is off,
 * and how each peer connection is doing.
 *
 * Only this client's own view lives here. Who is in each channel is server data and
 * belongs in the query cache, patched by `voice:state` events; keeping it here too
 * would be two sources of truth for the same list.
 *
 * No async and no `RTCPeerConnection`: the connections themselves live in
 * `peer-mesh.ts`, and only facts about them are recorded here.
 */
export const useVoiceStore = create<VoiceState>((set) => ({
  channelId: null,
  status: 'idle',
  errorMessage: null,
  selfMute: false,
  selfDeaf: false,
  peers: {},

  connecting: (channelId) =>
    set({ channelId, status: 'connecting', errorMessage: null, peers: {} }),

  connected: () => set({ status: 'connected', errorMessage: null }),

  // The channel is kept so the tray can still name what failed.
  failed: (message) => set({ status: 'error', errorMessage: message, peers: {} }),

  left: () =>
    set({
      channelId: null,
      status: 'idle',
      errorMessage: null,
      selfMute: false,
      selfDeaf: false,
      peers: {},
    }),

  setSelf: ({ selfMute, selfDeaf }) => set({ selfMute, selfDeaf }),

  setPeer: (userId, entry) =>
    set((state) => ({
      peers: {
        ...state.peers,
        [userId]: { stream: null, status: 'connecting', ...state.peers[userId], ...entry },
      },
    })),

  dropPeer: (userId) =>
    set((state) => {
      if (!state.peers[userId]) return state;

      const { [userId]: _gone, ...rest } = state.peers;

      return { peers: rest };
    }),
}));
