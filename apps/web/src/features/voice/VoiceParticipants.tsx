import { useEffect, useRef } from 'react';
import { MicOff, VolumeX } from 'lucide-react';
import type { VoiceParticipant } from '@nestcord/shared';

import { UserAvatar } from '@/components/UserAvatar';
import { useVoiceStore } from '@/stores/voice-store';

interface VoiceParticipantsProps {
  participants: VoiceParticipant[];
}

/** Who is in a voice channel, listed under it. Renders nothing for an empty call. */
export function VoiceParticipants({ participants }: VoiceParticipantsProps) {
  if (participants.length === 0) return null;

  return (
    <ul className="mt-0.5 mb-1 space-y-0.5 pl-7">
      {participants.map((participant) => (
        <li key={participant.user.id} className="flex items-center gap-2 py-0.5">
          <UserAvatar user={participant.user} size="sm" />
          <span className="text-content-400 min-w-0 flex-1 truncate text-xs">
            {participant.user.displayName ?? participant.user.username}
          </span>

          {participant.selfDeaf ? (
            <VolumeX className="text-content-500 size-3.5 shrink-0" aria-label="Deafened" />
          ) : (
            participant.selfMute && (
              <MicOff className="text-content-500 size-3.5 shrink-0" aria-label="Muted" />
            )
          )}

          <PeerAudio userId={participant.user.id} />
        </li>
      ))}
    </ul>
  );
}

/**
 * Plays one peer's audio.
 *
 * A `MediaStream` cannot be a React prop on an `<audio>` element, so it is attached to
 * the node itself. Autoplay needs a user gesture, which joining a channel is — and a
 * peer we are not in a call with has no stream, so nothing renders.
 */
function PeerAudio({ userId }: { userId: string }) {
  const stream = useVoiceStore((state) => state.peers[userId]?.stream ?? null);
  const selfDeaf = useVoiceStore((state) => state.selfDeaf);
  const element = useRef<HTMLAudioElement>(null);

  useEffect(() => {
    if (!element.current) return;

    element.current.srcObject = stream;
  }, [stream]);

  if (!stream) return null;

  return <audio ref={element} autoPlay muted={selfDeaf} className="hidden" />;
}
