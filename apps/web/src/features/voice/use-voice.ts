import { useContext } from 'react';

import {
  MAX_VOICE_PARTICIPANTS,
  SocketEvent,
  type VoiceJoinAck,
  type VoiceJoinRefusal,
} from '@nestcord/shared';

import { useVoiceStore } from '@/stores/voice-store';
import { RealtimeContext } from '@/websocket/realtime-context';
import {
  addPeer,
  openMicrophone,
  setMuted,
  startMesh,
  stopMesh,
  type SignalSender,
} from './peer-mesh';

const SIGNAL_EVENTS = {
  offer: SocketEvent.VOICE_OFFER,
  answer: SocketEvent.VOICE_ANSWER,
  candidate: SocketEvent.VOICE_CANDIDATE,
} as const;

/** What a refused join says, in words the person can act on. */
const JOIN_REFUSALS: Record<VoiceJoinRefusal, string> = {
  full: `That voice channel is full (${MAX_VOICE_PARTICIPANTS} of ${MAX_VOICE_PARTICIPANTS}).`,
  forbidden: 'You are not allowed to join that voice channel.',
  'not-voice': 'That is not a voice channel.',
};

/**
 * Joining, leaving and muting a call.
 *
 * State and actions only, no subscriptions: the signalling listeners are registered
 * once for the whole app in `voice-listeners.ts`, so this is safe to call from as many
 * components as need it. The actions are plain functions rather than memoised ones,
 * like `useTyping` — they read the socket handle's `current`, which is exactly what a
 * dependency array cannot describe.
 */
export function useVoice() {
  const handle = useContext(RealtimeContext);
  const store = useVoiceStore();

  /**
   * Opens the microphone, then asks to join.
   *
   * In that order deliberately: a refused permission prompt becomes an error the
   * person reads, rather than a call that has already told everyone you arrived. No
   * peer connection opens until the server's ack says yes.
   */
  const join = async (channelId: string) => {
    const socket = handle?.current;

    if (!socket) return;

    const { connecting, connected, failed } = useVoiceStore.getState();

    // Hopping straight from one channel to another: leave the first properly rather
    // than letting two meshes overlap. The server does the same on its side.
    if (useVoiceStore.getState().channelId) {
      socket.emit(SocketEvent.VOICE_LEAVE);
      stopMesh();
    }

    connecting(channelId);

    try {
      await openMicrophone();
    } catch {
      failed('NestCord could not use your microphone. Check the site’s permissions.');

      return;
    }

    const sender: SignalSender = (event, payload) => {
      socket.emit(SIGNAL_EVENTS[event], { channelId, ...payload });
    };

    startMesh(sender);

    socket.emit(SocketEvent.VOICE_JOIN, { channelId }, (ack: VoiceJoinAck) => {
      if (!ack?.ok) {
        stopMesh();
        failed(JOIN_REFUSALS[ack?.reason] ?? JOIN_REFUSALS.forbidden);

        return;
      }

      connected();

      // We are the newcomer, so we offer to everybody who was already here. They only
      // answer, which is what keeps two offers from crossing.
      for (const participant of ack.participants) {
        void addPeer(participant.user.id, true);
      }
    });
  };

  const leave = () => {
    handle?.current?.emit(SocketEvent.VOICE_LEAVE);
    stopMesh();
    useVoiceStore.getState().left();
  };

  /** Tells the channel about a mute or deafen, and applies it locally. */
  const setSelfState = (next: { selfMute: boolean; selfDeaf: boolean }) => {
    const { channelId, setSelf } = useVoiceStore.getState();

    if (!channelId) return;

    setSelf(next);
    // Deafening silences everyone else, which would be rude to do while still talking
    // at them — so it mutes too.
    setMuted(next.selfMute || next.selfDeaf);
    handle?.current?.emit(SocketEvent.VOICE_UPDATE, { channelId, ...next });
  };

  return {
    channelId: store.channelId,
    status: store.status,
    errorMessage: store.errorMessage,
    selfMute: store.selfMute,
    selfDeaf: store.selfDeaf,
    peers: store.peers,
    join,
    leave,

    toggleMute: () => {
      const { selfMute, selfDeaf } = useVoiceStore.getState();

      setSelfState({ selfMute: !selfMute, selfDeaf });
    },

    toggleDeaf: () => {
      const { selfMute, selfDeaf } = useVoiceStore.getState();
      const nextDeaf = !selfDeaf;

      setSelfState({ selfMute: nextDeaf ? true : selfMute, selfDeaf: nextDeaf });
    },
  };
}
