import { useVoiceStore } from '@/stores/voice-store';
import { iceConfig } from './ice-config';

/** How the mesh sends a signal — supplied by the hook, so this file knows no socket. */
export type SignalSender = (
  event: 'offer' | 'answer' | 'candidate',
  payload: Record<string, unknown>,
) => void;

/**
 * The peer connections behind a call.
 *
 * A plain module rather than a store or a hook: `RTCPeerConnection` and `MediaStream`
 * are imperative resources with a lifetime longer than any render, and re-creating
 * them because a component remounted would drop the call. Only *facts* about them go
 * into the store, which is what the UI reads.
 *
 * Mesh, not a server: everyone connects to everyone, so eight people is seven
 * connections each. That is the reason for the cap.
 *
 * Who offers is settled by convention rather than negotiated — the person joining
 * offers to everybody already there, and the people already there only ever answer.
 * Both sides offering at once is the classic glare bug, and this avoids needing to
 * resolve it.
 */
let localStream: MediaStream | null = null;
let send: SignalSender | null = null;
const peers = new Map<string, RTCPeerConnection>();

/** Asks for the microphone. Throws if the person says no, which the caller reports. */
export async function openMicrophone(): Promise<MediaStream> {
  localStream = await navigator.mediaDevices.getUserMedia({
    audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
    video: false,
  });

  return localStream;
}

export function startMesh(sender: SignalSender): void {
  send = sender;
}

/**
 * Starts a connection to one peer.
 *
 * `initiate` is true for the peers who were already in the channel when we joined —
 * we offer to them, and they will answer.
 */
export async function addPeer(userId: string, initiate: boolean): Promise<void> {
  const peer = ensurePeer(userId);

  if (!initiate) return;

  const offer = await peer.createOffer();
  await peer.setLocalDescription(offer);

  send?.('offer', { targetUserId: userId, sdp: offer.sdp ?? '' });
}

export async function acceptOffer(userId: string, sdp: string): Promise<void> {
  const peer = ensurePeer(userId);

  await peer.setRemoteDescription({ type: 'offer', sdp });

  const answer = await peer.createAnswer();
  await peer.setLocalDescription(answer);

  send?.('answer', { targetUserId: userId, sdp: answer.sdp ?? '' });
}

export async function acceptAnswer(userId: string, sdp: string): Promise<void> {
  const peer = peers.get(userId);

  if (!peer || peer.signalingState === 'stable') return;

  await peer.setRemoteDescription({ type: 'answer', sdp });
}

export async function addCandidate(
  userId: string,
  candidate: string,
  sdpMid: string | null,
  sdpMLineIndex: number | null,
): Promise<void> {
  const peer = peers.get(userId);

  if (!peer) return;

  try {
    await peer.addIceCandidate({ candidate, sdpMid, sdpMLineIndex });
  } catch {
    // A candidate that arrives before the remote description, or after the connection
    // settled, is normal and not worth surfacing.
  }
}

export function removePeer(userId: string): void {
  peers.get(userId)?.close();
  peers.delete(userId);
  useVoiceStore.getState().dropPeer(userId);
}

/** Mutes by disabling the track rather than dropping it, so nothing renegotiates. */
export function setMuted(muted: boolean): void {
  for (const track of localStream?.getAudioTracks() ?? []) {
    track.enabled = !muted;
  }
}

/** Ends the call: every connection closed, and the microphone light off. */
export function stopMesh(): void {
  for (const userId of [...peers.keys()]) {
    removePeer(userId);
  }

  for (const track of localStream?.getTracks() ?? []) {
    track.stop();
  }

  localStream = null;
  send = null;
}

function ensurePeer(userId: string): RTCPeerConnection {
  const existing = peers.get(userId);

  if (existing) return existing;

  const peer = new RTCPeerConnection(iceConfig);
  const store = useVoiceStore.getState();

  // Publish our own microphone. A listener without SPEAK never opened one, so there
  // is nothing to add and the connection is receive-only.
  for (const track of localStream?.getAudioTracks() ?? []) {
    peer.addTrack(track, localStream as MediaStream);
  }

  peer.ontrack = (event) => {
    const [stream] = event.streams;

    if (stream) useVoiceStore.getState().setPeer(userId, { stream, status: 'connected' });
  };

  peer.onicecandidate = (event) => {
    if (!event.candidate) return;

    send?.('candidate', {
      targetUserId: userId,
      candidate: event.candidate.candidate,
      sdpMid: event.candidate.sdpMid,
      sdpMLineIndex: event.candidate.sdpMLineIndex,
    });
  };

  peer.onconnectionstatechange = () => {
    // Without TURN some pairs simply cannot find a route; saying so beats silence.
    if (peer.connectionState === 'failed') {
      useVoiceStore.getState().setPeer(userId, { status: 'failed' });
    }

    if (peer.connectionState === 'connected') {
      useVoiceStore.getState().setPeer(userId, { status: 'connected' });
    }
  };

  store.setPeer(userId, { status: 'connecting' });
  peers.set(userId, peer);

  return peer;
}
