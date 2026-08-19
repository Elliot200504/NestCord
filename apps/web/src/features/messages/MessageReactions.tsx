import type { MessageReaction } from '@nestcord/shared';

import { NO_HOVER, useMediaQuery } from '@/hooks/useMediaQuery';
import { cn } from '@/lib/utils';

interface MessageReactionsProps {
  reactions: MessageReaction[];
  /** Absent when the reader may not react here — the counts still show. */
  onToggle?: (emoji: string) => void;
}

export function MessageReactions({ reactions, onToggle }: MessageReactionsProps) {
  const noHover = useMediaQuery(NO_HOVER);

  if (reactions.length === 0) return null;

  return (
    <ul className="mt-1.5 flex flex-wrap gap-1">
      {reactions.map((reaction) => (
        <li key={reaction.emoji}>
          <button
            type="button"
            disabled={!onToggle}
            onClick={() => onToggle?.(reaction.emoji)}
            // The label says what the click will do, which is what a screen reader
            // needs — the emoji and count alone do not say it.
            aria-label={`${reaction.me ? 'Remove your' : 'Add a'} ${reaction.emoji} reaction (${reaction.count})`}
            aria-pressed={reaction.me}
            className={cn(
              'flex items-center gap-1 rounded-md border text-xs transition-colors',
              noHover ? 'px-2 py-1' : 'px-1.5 py-0.5',
              reaction.me
                ? 'border-primary/60 bg-primary/15 text-primary'
                : 'border-border bg-surface-700/60 text-content-200',
              onToggle && 'hover:border-primary/60 cursor-pointer',
            )}
          >
            <span aria-hidden>{reaction.emoji}</span>
            <span className="tabular-nums">{reaction.count}</span>
          </button>
        </li>
      ))}
    </ul>
  );
}
