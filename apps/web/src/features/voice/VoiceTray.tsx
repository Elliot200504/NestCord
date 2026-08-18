import { Headphones, HeadphoneOff, Mic, MicOff, PhoneOff } from 'lucide-react';

import { cn } from '@/lib/utils';
import { useVoice } from './use-voice';

interface VoiceTrayProps {
  /** The channel's name, for saying what you are connected to. */
  channelName: string | undefined;
}

/**
 * The state of your own call, and the way out of it.
 *
 * Hidden entirely when you are not in one — including after an error, which is
 * dismissed by the same button that leaves.
 */
export function VoiceTray({ channelName }: VoiceTrayProps) {
  const { status, errorMessage, selfMute, selfDeaf, peers, leave, toggleMute, toggleDeaf } =
    useVoice();

  if (status === 'idle') return null;

  const failed = Object.entries(peers).filter(([, peer]) => peer.status === 'failed');

  return (
    <div className="bg-surface-900 border-border space-y-1.5 border-t px-2.5 py-2">
      <div className="flex items-center gap-2">
        <span className="min-w-0 flex-1 leading-tight">
          <span
            className={cn(
              'block truncate text-xs font-medium',
              status === 'error' ? 'text-destructive' : 'text-online',
            )}
          >
            {status === 'connecting' && 'Connecting…'}
            {status === 'connected' && 'Voice connected'}
            {status === 'error' && 'Voice failed'}
          </span>
          <span className="text-content-500 block truncate text-xs">
            {errorMessage ?? channelName ?? 'Voice channel'}
          </span>
        </span>

        <button
          type="button"
          onClick={leave}
          aria-label="Disconnect from voice"
          className="text-content-300 hover:text-destructive hover:bg-surface-700 grid size-7 shrink-0 place-items-center rounded-lg transition-colors"
        >
          <PhoneOff className="size-4" aria-hidden />
        </button>
      </div>

      {failed.length > 0 && (
        <p className="text-content-500 text-xs">
          Could not reach {failed.length === 1 ? 'one person' : `${failed.length} people`} in this
          call.
        </p>
      )}

      {status !== 'error' && (
        <div className="flex items-center gap-1">
          <TrayToggle
            label={selfMute ? 'Unmute microphone' : 'Mute microphone'}
            pressed={selfMute}
            onClick={toggleMute}
          >
            {selfMute ? <MicOff className="size-4" aria-hidden /> : <Mic className="size-4" aria-hidden />}
          </TrayToggle>

          <TrayToggle
            label={selfDeaf ? 'Undeafen' : 'Deafen'}
            pressed={selfDeaf}
            onClick={toggleDeaf}
          >
            {selfDeaf ? (
              <HeadphoneOff className="size-4" aria-hidden />
            ) : (
              <Headphones className="size-4" aria-hidden />
            )}
          </TrayToggle>
        </div>
      )}
    </div>
  );
}

interface TrayToggleProps {
  label: string;
  pressed: boolean;
  onClick: () => void;
  children: React.ReactNode;
}

function TrayToggle({ label, pressed, onClick, children }: TrayToggleProps) {
  return (
    <button
      type="button"
      aria-label={label}
      aria-pressed={pressed}
      onClick={onClick}
      className={cn(
        'grid size-7 shrink-0 place-items-center rounded-lg transition-colors',
        pressed
          ? 'bg-surface-600 text-destructive'
          : 'text-content-300 hover:bg-surface-700 hover:text-content-100',
      )}
    >
      {children}
    </button>
  );
}
