import type { Socket } from 'socket.io-client';

import {
  SocketEvent,
  type VoiceCandidatePayload,
  type VoiceDescriptionPayload,
  type VoiceLeavePayload,
} from '@nestcord/shared';

import { useVoiceStore } from '@/stores/voice-store';
import { acceptAnswer, acceptOffer, addCandidate, removePeer, stopMesh } from './peer-mesh';

/**
 * Signalling, registered once with every other listener.
 *
 * Deliberately not inside a component's effect: a hook called from two places would
 * answer the same offer twice, which is exactly the duplicate-listener bug the
 * realtime listeners file warns about. Living here means one subscription for the
 * whole app, however many components show voice.
 *
 * Every handler ignores anything for a channel this client is not in — the server
 * already authorized the relay, but a stale signal for a call we just left has
 * nothing to connect to.
 */
export function registerVoiceListeners(socket: Socket, viewerId: string): () => void {
  const inCall = (channelId: string) => useVoiceStore.getState().channelId === channelId;

  const onOffer = (payload: VoiceDescriptionPayload) => {
    if (inCall(payload.channelId)) void acceptOffer(payload.fromUserId, payload.sdp);
  };

  const onAnswer = (payload: VoiceDescriptionPayload) => {
    if (inCall(payload.channelId)) void acceptAnswer(payload.fromUserId, payload.sdp);
  };

  const onCandidate = (payload: VoiceCandidatePayload) => {
    if (!inCall(payload.channelId)) return;

    void addCandidate(payload.fromUserId, payload.candidate, payload.sdpMid, payload.sdpMLineIndex);
  };

  /**
   * Somebody left the call.
   *
   * When that somebody is us, we did not click anything — we were kicked, banned, or
   * lost CONNECT — so the whole call ends here. This is the only way the server can
   * stop us talking: once peer connections are up, the media never passes through it.
   */
  const onStateLeave = (payload: VoiceLeavePayload) => {
    if (!inCall(payload.channelId)) return;

    if (payload.userId === viewerId) {
      stopMesh();
      useVoiceStore.getState().failed('You were disconnected from the voice channel.');

      return;
    }

    removePeer(payload.userId);
  };

  socket.on(SocketEvent.VOICE_OFFER, onOffer);
  socket.on(SocketEvent.VOICE_ANSWER, onAnswer);
  socket.on(SocketEvent.VOICE_CANDIDATE, onCandidate);
  socket.on(SocketEvent.VOICE_STATE_LEAVE, onStateLeave);

  const onDisconnect = () => {
    // The socket is gone, so no signalling can reach the peers and no peer can be
    // told we left. Tearing the mesh down is the honest end to the call.
    if (!useVoiceStore.getState().channelId) return;

    stopMesh();
    useVoiceStore.getState().failed('Voice disconnected.');
  };

  socket.on('disconnect', onDisconnect);

  return () => {
    socket.off(SocketEvent.VOICE_OFFER, onOffer);
    socket.off(SocketEvent.VOICE_ANSWER, onAnswer);
    socket.off(SocketEvent.VOICE_CANDIDATE, onCandidate);
    socket.off(SocketEvent.VOICE_STATE_LEAVE, onStateLeave);
    socket.off('disconnect', onDisconnect);
  };
}
