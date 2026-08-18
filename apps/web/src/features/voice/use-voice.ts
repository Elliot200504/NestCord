import { useCallback, useContext, useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';

import {
  MAX_VOICE_PARTICIPANTS,
  SocketEvent,
  type VoiceCandidatePayload,
  type VoiceDescriptionPayload,
  type VoiceJoinAck,
  type VoiceJoinRefusal,
  type VoiceLeavePayload,
} from '@nestcord/shared';

import { useVoiceStore } from '@/stores/voice-store';
import { RealtimeContext } from '@/websocket/realtime-context';
import {
  acceptAnswer,
  acceptOffer,
  addCandidate,
  addPeer,
  openMicrophone,
  removePeer,
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
 * Joining, leaving, muting — the React seam between the socket and the mesh.
 *
 * The microphone is opened *before* the join is sent, so a refused permission prompt
 * is an error the person sees rather than a call that half-starts. The join is then
 * answered by an ack: only once the server says yes does any peer connection open.
 */
export function useVoice() {
  const handle = useContext(RealtimeContext);
  const queryClient = useQueryClient();
  const store = useVoiceStore();

  const join = useCallback(
    async (channelId: string) => {
      const socket = handle?.current;

      if (!socket) return;

      const { connecting, connected, failed } = useVoiceStore.getState();

      // Leaving first keeps the client's own state honest when someone hops straight
      // from one channel to another; the server does the same on its side.
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

        // We are the newcomer, so we offer to everybody who was already here. They
        // only answer, which is what keeps two offers from crossing.
        for (const participant of ack.participants) {
          void addPeer(participant.user.id, true);
        }
      });
    },
    [handle],
  );

  const leave = useCallback(() => {
    handle?.current?.emit(SocketEvent.VOICE_LEAVE);
    stopMesh();
    useVoiceStore.getState().left();
  }, [handle]);

  /** Tells the channel about a mute or deafen, and applies it locally. */
  const setSelfState = useCallback(
    (next: { selfMute: boolean; selfDeaf: boolean }) => {
      const { channelId, setSelf } = useVoiceStore.getState();

      if (!channelId) return;

      setSelf(next);
      // Deafening silences everyone else, which would be rude to do while still
      // talking at them — so it mutes too.
      setMuted(next.selfMute || next.selfDeaf);
      handle?.current?.emit(SocketEvent.VOICE_UPDATE, { channelId, ...next });
    },
    [handle],
  );

  const toggleMute = useCallback(() => {
    const { selfMute, selfDeaf } = useVoiceStore.getState();

    setSelfState({ selfMute: !selfMute, selfDeaf });
  }, [setSelfState]);

  const toggleDeaf = useCallback(() => {
    const { selfMute, selfDeaf } = useVoiceStore.getState();
    const nextDeaf = !selfDeaf;

    setSelfState({ selfMute: nextDeaf ? true : selfMute, selfDeaf: nextDeaf });
  }, [setSelfState]);

  // Signalling and departures, for as long as this app is mounted. One subscription
  // at the top rather than one per channel row, so an offer is never answered twice.
  useEffect(() => {
    const socket = handle?.current;

    if (!socket) return;

    const inCall = (channelId: string) => useVoiceStore.getState().channelId === channelId;

    const onOffer = (payload: VoiceDescriptionPayload) => {
      if (inCall(payload.channelId)) void acceptOffer(payload.fromUserId, payload.sdp);
    };

    const onAnswer = (payload: VoiceDescriptionPayload) => {
      if (inCall(payload.channelId)) void acceptAnswer(payload.fromUserId, payload.sdp);
    };

    const onCandidate = (payload: VoiceCandidatePayload) => {
      if (!inCall(payload.channelId)) return;

      void addCandidate(
        payload.fromUserId,
        payload.candidate,
        payload.sdpMid,
        payload.sdpMLineIndex,
      );
    };

    /**
     * Somebody left. When it is us, we were removed rather than having clicked
     * anything — kicked, or an override took CONNECT away — so the call ends here.
     */
    const onStateLeave = (payload: VoiceLeavePayload) => {
      if (!inCall(payload.channelId)) return;

      removePeer(payload.userId);
    };

    socket.on(SocketEvent.VOICE_OFFER, onOffer);
    socket.on(SocketEvent.VOICE_ANSWER, onAnswer);
    socket.on(SocketEvent.VOICE_CANDIDATE, onCandidate);
    socket.on(SocketEvent.VOICE_STATE_LEAVE, onStateLeave);

    return () => {
      socket.off(SocketEvent.VOICE_OFFER, onOffer);
      socket.off(SocketEvent.VOICE_ANSWER, onAnswer);
      socket.off(SocketEvent.VOICE_CANDIDATE, onCandidate);
      socket.off(SocketEvent.VOICE_STATE_LEAVE, onStateLeave);
    };
  }, [handle, queryClient]);

  return {
    channelId: store.channelId,
    status: store.status,
    errorMessage: store.errorMessage,
    selfMute: store.selfMute,
    selfDeaf: store.selfDeaf,
    peers: store.peers,
    join,
    leave,
    toggleMute,
    toggleDeaf,
  };
}
