import { Volume2 } from 'lucide-react';

import {
  has,
  MAX_VOICE_PARTICIPANTS,
  Permission,
  type Channel,
  type VoiceParticipant,
} from '@nestcord/shared';

import { cn } from '@/lib/utils';

interface VoiceChannelButtonProps {
  channel: Channel;
  participants: VoiceParticipant[];
  isActive: boolean;
  onJoin: () => void;
}

/**
 * A voice channel: clicking it connects you rather than navigating anywhere.
 *
 * The disabled states are courtesy only — the gateway refuses a join it should not
 * allow, whatever this renders. Saying *why* it is disabled matters more than hiding
 * it, because a full channel looks identical to a broken one otherwise.
 */
export function VoiceChannelButton({ channel, participants, isActive, onJoin }: VoiceChannelButtonProps) {
  const isFull = participants.length >= MAX_VOICE_PARTICIPANTS;
  const canConnect = has(channel.permissions, Permission.CONNECT);
  const disabled = (isFull && !isActive) || !canConnect;

  const reason = !canConnect
    ? 'You do not have permission to join this voice channel'
    : isFull && !isActive
      ? `This voice channel is full (${MAX_VOICE_PARTICIPANTS} of ${MAX_VOICE_PARTICIPANTS})`
      : undefined;

  return (
    <button
      type="button"
      onClick={onJoin}
      disabled={disabled}
      title={reason}
      className={cn(
        'text-content-300 hover:bg-surface-700 hover:text-content-100 flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-left text-sm transition-colors',
        isActive && 'bg-surface-600 text-content-100',
        disabled && 'hover:bg-transparent hover:text-content-300 cursor-not-allowed opacity-50',
      )}
    >
      <Volume2 className="text-content-500 size-4 shrink-0" aria-hidden />
      <span className="truncate">{channel.name}</span>

      {participants.length > 0 && (
        <span className="text-content-500 ml-auto shrink-0 text-xs">
          {participants.length}/{MAX_VOICE_PARTICIPANTS}
        </span>
      )}
    </button>
  );
}
