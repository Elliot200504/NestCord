import type { ReactNode } from 'react';
import { Link } from '@tanstack/react-router';
import { Headphones, HeadphoneOff, Mic, MicOff, Settings } from 'lucide-react';

import type { PresenceStatus } from '@nestcord/shared';

import { useCurrentUser } from '@/features/auth/use-auth';
import { useVoice } from '@/features/voice/use-voice';
import { StatusMenu } from './StatusMenu';
import { UserAvatar } from './UserAvatar';

const STATUS_LABELS: Record<PresenceStatus, string> = {
  ONLINE: 'Online',
  IDLE: 'Idle',
  DO_NOT_DISTURB: 'Do not disturb',
  OFFLINE: 'Invisible',
};

/** Bottom-left panel: who you are, plus quick toggles. */
export function UserPanel() {
  const { data: user, isPending } = useCurrentUser();
  const { status, selfMute, selfDeaf, toggleMute, toggleDeaf } = useVoice();
  // Nothing to mute when you are not in a call, so the pair is inert until you are.
  const inCall = status === 'connecting' || status === 'connected';

  return (
    <div className="bg-surface-900 border-border flex items-center gap-2 border-t px-2 py-2.5">
      {isPending || !user ? (
        <div className="flex flex-1 items-center gap-2">
          <span className="bg-surface-600 size-8 animate-pulse rounded-full" />
          <span className="bg-surface-600 h-3 w-24 animate-pulse rounded-full" />
        </div>
      ) : (
        <StatusMenu user={user}>
          <button
            type="button"
            className="hover:bg-surface-700 -mx-1 flex min-w-0 flex-1 items-center gap-2 rounded-lg px-1 py-1 text-left transition-colors"
          >
            <UserAvatar user={user} size="md" status={user.status} />
            <span className="min-w-0 flex-1 leading-tight">
              <span className="block truncate text-sm font-medium">
                {user.displayName ?? user.username}
              </span>
              <span className="text-content-500 block truncate text-xs">
                {STATUS_LABELS[user.status]}
              </span>
            </span>
          </button>
        </StatusMenu>
      )}

      <IconButton
        label={selfMute ? 'Unmute microphone' : 'Mute microphone'}
        pressed={selfMute}
        onClick={toggleMute}
        disabled={!inCall}
      >
        {selfMute ? <MicOff className="size-4" aria-hidden /> : <Mic className="size-4" aria-hidden />}
      </IconButton>
      <IconButton
        label={selfDeaf ? 'Undeafen' : 'Deafen'}
        pressed={selfDeaf}
        onClick={toggleDeaf}
        disabled={!inCall}
      >
        {selfDeaf ? (
          <HeadphoneOff className="size-4" aria-hidden />
        ) : (
          <Headphones className="size-4" aria-hidden />
        )}
      </IconButton>

      <Link
        to="/settings/account"
        aria-label="User settings"
        className="text-content-300 hover:bg-surface-700 hover:text-content-100 grid size-7 shrink-0 place-items-center rounded-lg transition-colors"
      >
        <Settings className="size-4" aria-hidden />
      </Link>
    </div>
  );
}

interface IconButtonProps {
  label: string;
  children: ReactNode;
  onClick?: () => void;
  disabled?: boolean;
  /** Set when the button is a toggle, so a reader is told which way it is. */
  pressed?: boolean;
}

function IconButton({ label, children, onClick, disabled, pressed }: IconButtonProps) {
  return (
    <button
      type="button"
      aria-label={label}
      aria-pressed={pressed}
      onClick={onClick}
      disabled={disabled}
      className="text-content-300 hover:bg-surface-700 hover:text-content-100 grid size-7 shrink-0 place-items-center rounded-lg transition-colors disabled:opacity-50"
    >
      {children}
    </button>
  );
}
