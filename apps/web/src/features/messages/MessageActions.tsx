import { Copy, Pencil, Reply, SmilePlus, Trash2 } from 'lucide-react';

import { NO_HOVER, useMediaQuery } from '@/hooks/useMediaQuery';
import { cn } from '@/lib/utils';

/** The emoji offered on hover. A full picker is more than this project needs. */
const QUICK_REACTIONS = ['👍', '❤️', '😂', '🎉', '👀'] as const;

export interface MessageActionsProps {
  /** Also reveal when the surrounding group block is hovered, not only this row. */
  revealOnBlockHover: boolean;
  /** Set once a touch reader has tapped the row — there is no hover to reveal it. */
  forceVisible: boolean;
  /** Each action is absent, not disabled, when the reader may not take it. */
  onReply?: () => void;
  onReact?: (emoji: string) => void;
  onEdit?: () => void;
  onDelete?: () => void;
  onCopy: () => void;
}

/**
 * The message toolbar (PLAN.MD §15).
 *
 * On a device that can hover, it floats over the message and is revealed by hover or
 * keyboard focus. On one that cannot, floating over the message just hides whatever
 * it is covering, so instead it sits in the normal flow — its own row, own space —
 * and only when `forceVisible` says a tap opened it.
 */
export function MessageActions(props: MessageActionsProps) {
  const noHover = useMediaQuery(NO_HOVER);

  return noHover ? <TapToolbar {...props} /> : <HoverToolbar {...props} />;
}

function HoverToolbar({
  revealOnBlockHover,
  onReply,
  onReact,
  onEdit,
  onDelete,
  onCopy,
}: MessageActionsProps) {
  return (
    <div
      className={cn(
        'bg-surface-700 border-border absolute -top-4 right-0 flex items-center gap-0.5 rounded-lg border px-1 py-0.5 opacity-0 shadow-sm transition-opacity',
        'group-hover/msg:opacity-100 focus-within:opacity-100',
        revealOnBlockHover && 'group-hover/block:opacity-100',
      )}
    >
      {onReact &&
        QUICK_REACTIONS.map((emoji) => (
          <button
            key={emoji}
            type="button"
            onClick={() => onReact(emoji)}
            aria-label={`React with ${emoji}`}
            className="hover:bg-surface-600 rounded px-1 py-0.5 text-sm transition-colors"
          >
            <span aria-hidden>{emoji}</span>
          </button>
        ))}

      {onReact && <SmilePlus className="text-content-500 mx-0.5 size-3.5" aria-hidden />}

      {onReply && <ActionButton label="Reply" icon={Reply} onClick={onReply} />}
      {onEdit && <ActionButton label="Edit message" icon={Pencil} onClick={onEdit} />}
      <ActionButton label="Copy text" icon={Copy} onClick={onCopy} />
      {onDelete && (
        <ActionButton label="Delete message" icon={Trash2} onClick={onDelete} destructive />
      )}
    </div>
  );
}

function TapToolbar({
  forceVisible,
  onReply,
  onReact,
  onEdit,
  onDelete,
  onCopy,
}: MessageActionsProps) {
  if (!forceVisible) return null;

  return (
    <div className="bg-surface-700 border-border mt-1.5 flex w-fit flex-wrap items-center gap-1 rounded-xl border p-1.5 shadow-sm">
      {onReact && (
        <div className="flex items-center gap-1">
          {QUICK_REACTIONS.map((emoji) => (
            <button
              key={emoji}
              type="button"
              onClick={() => onReact(emoji)}
              aria-label={`React with ${emoji}`}
              className="hover:bg-surface-600 grid size-9 place-items-center rounded-lg text-base transition-colors"
            >
              <span aria-hidden>{emoji}</span>
            </button>
          ))}
        </div>
      )}

      {onReact && <div className="bg-border mx-0.5 h-6 w-px shrink-0" aria-hidden />}

      <div className="flex items-center gap-1">
        {onReply && <ActionButton label="Reply" icon={Reply} onClick={onReply} large />}
        {onEdit && <ActionButton label="Edit message" icon={Pencil} onClick={onEdit} large />}
        <ActionButton label="Copy text" icon={Copy} onClick={onCopy} large />
        {onDelete && (
          <ActionButton label="Delete message" icon={Trash2} onClick={onDelete} destructive large />
        )}
      </div>
    </div>
  );
}

function ActionButton({
  label,
  icon: Icon,
  onClick,
  destructive,
  large,
}: {
  label: string;
  icon: typeof Reply;
  onClick: () => void;
  destructive?: boolean;
  large?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      title={label}
      className={cn(
        'hover:bg-surface-600 rounded-lg transition-colors',
        large ? 'grid size-9 place-items-center' : 'p-1',
        destructive ? 'text-destructive' : 'text-content-300 hover:text-content-100',
      )}
    >
      <Icon className="size-4" aria-hidden />
    </button>
  );
}
