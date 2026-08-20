import { useState, type KeyboardEvent, type MouseEvent } from 'react';

import {
  MESSAGE_MAX_LENGTH,
  type Channel,
  type Message,
  type ServerMember,
} from '@nestcord/shared';

import { NO_HOVER, useMediaQuery } from '@/hooks/useMediaQuery';
import { cn } from '@/lib/utils';
import { messageAnchorId } from './message-anchor';
import { formatFullTime } from './message-grouping';
import { MessageActions } from './MessageActions';
import { MessageAttachments } from './MessageAttachments';
import { MessageContent } from './MessageContent';
import { MessageReactions } from './MessageReactions';

export interface MessageProps {
  message: Message;
  serverId: string;
  members: ServerMember[];
  channels: Channel[];
  /**
   * Reveals the actions when anything in the group block is hovered, not just this
   * row — so hovering the reply quote or the author line shows them too. Only set for
   * a group holding one message; with several, each row answers for itself, or every
   * toolbar in the block would appear at once.
   */
  revealOnBlockHover: boolean;
  /** Briefly ringed after someone travelled here from a reply quote. */
  isFlashing: boolean;
  /** The message whose toolbar a touch reader tapped open, if any. */
  revealedId: string | null;
  onReveal: (messageId: string | null) => void;
  canReply: boolean;
  canReact: boolean;
  canEdit: boolean;
  canDelete: boolean;
  onReply: (message: Message) => void;
  onReact: (message: Message, emoji: string) => void;
  onEdit: (message: Message, content: string) => void;
  onDelete: (message: Message) => void;
}

/**
 * One message: its text, what it answers, what came with it, and what can be done to
 * it. Editing happens in place, because leaving the channel to fix a typo loses your
 * place in the conversation.
 */
export function MessageRow({
  message,
  serverId,
  members,
  channels,
  revealOnBlockHover,
  isFlashing,
  revealedId,
  onReveal,
  canReply,
  canReact,
  canEdit,
  canDelete,
  onReply,
  onReact,
  onEdit,
  onDelete,
}: MessageProps) {
  const [draft, setDraft] = useState<string | null>(null);
  const isEditing = draft !== null;
  const noHover = useMediaQuery(NO_HOVER);
  const isRevealed = revealedId === message.id;

  function handleRowClick(event: MouseEvent<HTMLDivElement>) {
    if (!noHover || isEditing) return;
    if ((event.target as HTMLElement).closest('a, button, input, textarea')) return;

    onReveal(isRevealed ? null : message.id);
  }

  function runAndClose(action: () => void) {
    action();
    if (noHover) onReveal(null);
  }

  function commit() {
    const trimmed = (draft ?? '').trim();

    if (trimmed && trimmed !== message.content) onEdit(message, trimmed);
    setDraft(null);
  }

  function handleKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key === 'Escape') setDraft(null);

    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      commit();
    }
  }

  return (
    <div
      // Addressable so a reply quote can scroll to it.
      id={messageAnchorId(message.id)}
      data-message-row
      onClick={handleRowClick}
      className={cn(
        // The negative margin and matching padding are always on, so the tint has
        // room to breathe without the text shifting when it appears.
        'group/msg relative -mx-2 scroll-mt-16 rounded-lg px-2 transition-colors duration-500',
        isFlashing && 'bg-primary/15',
      )}
    >
      {isEditing ? (
        <div className="py-0.5">
          <textarea
            value={draft}
            autoFocus
            rows={2}
            maxLength={MESSAGE_MAX_LENGTH}
            onChange={(event) => setDraft(event.target.value)}
            onKeyDown={handleKeyDown}
            aria-label="Edit message"
            className="bg-surface-600 border-border w-full resize-none rounded-lg border px-3 py-2 leading-relaxed outline-none"
          />
          <p className="text-content-500 mt-1 text-xs">
            Enter to save, Escape to cancel.{' '}
            <button type="button" onClick={() => setDraft(null)} className="hover:text-content-200">
              Cancel
            </button>
          </p>
        </div>
      ) : (
        <p className="text-content-100 leading-relaxed">
          <MessageContent
            content={message.content}
            members={members}
            channels={channels}
            serverId={serverId}
          />
          {message.editedAt && (
            <time
              dateTime={message.editedAt}
              title={`Edited ${formatFullTime(message.editedAt)}`}
              className="text-content-500 ml-1.5 text-[0.65rem]"
            >
              (edited)
            </time>
          )}
        </p>
      )}

      <MessageAttachments attachments={message.attachments} />

      {!isEditing && (
        <MessageActions
          revealOnBlockHover={revealOnBlockHover}
          forceVisible={isRevealed}
          onReply={canReply ? () => runAndClose(() => onReply(message)) : undefined}
          onReact={canReact ? (emoji) => runAndClose(() => onReact(message, emoji)) : undefined}
          onEdit={canEdit ? () => setDraft(message.content) : undefined}
          onDelete={canDelete ? () => runAndClose(() => onDelete(message)) : undefined}
          onCopy={() => runAndClose(() => void navigator.clipboard?.writeText(message.content))}
        />
      )}

      <MessageReactions
        reactions={message.reactions}
        onToggle={canReact ? (emoji) => onReact(message, emoji) : undefined}
      />
    </div>
  );
}
