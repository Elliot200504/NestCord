import { Copy, Pencil, Reply, SmilePlus, Trash2 } from 'lucide-react';

import { cn } from '@/lib/utils';

/** The emoji offered on hover. A full picker is more than this project needs. */
const QUICK_REACTIONS = ['👍', '❤️', '😂', '🎉', '👀'] as const;

export interface MessageActionsProps {
  /** Each action is absent, not disabled, when the reader may not take it. */
  onReply?: () => void;
  onReact?: (emoji: string) => void;
  onEdit?: () => void;
  onDelete?: () => void;
  onCopy: () => void;
}

/**
 * The hover toolbar on a message (PLAN.MD §15).
 *
 * Rendered always and revealed on hover or keyboard focus, rather than mounted on
 * hover: a toolbar that only exists while the mouse is over it cannot be reached by
 * tabbing to it.
 */
export function MessageActions({
  onReply,
  onReact,
  onEdit,
  onDelete,
  onCopy,
}: MessageActionsProps) {
  return (
    <div
      className={cn(
        'bg-surface-700 border-border absolute -top-3 right-2 flex items-center gap-0.5 rounded-lg border px-1 py-0.5 opacity-0 shadow-sm transition-opacity',
        'group-hover:opacity-100 focus-within:opacity-100',
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

function ActionButton({
  label,
  icon: Icon,
  onClick,
  destructive,
}: {
  label: string;
  icon: typeof Reply;
  onClick: () => void;
  destructive?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      title={label}
      className={cn(
        'hover:bg-surface-600 rounded p-1 transition-colors',
        destructive ? 'text-destructive' : 'text-content-300 hover:text-content-100',
      )}
    >
      <Icon className="size-4" aria-hidden />
    </button>
  );
}
