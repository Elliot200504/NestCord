import { useState, type KeyboardEvent } from 'react';

import {
  MESSAGE_MAX_LENGTH,
  type Channel,
  type Message,
  type ServerMember,
} from '@nestcord/shared';

import { formatFullTime } from './message-grouping';
import { MessageActions } from './MessageActions';
import { MessageAttachments } from './MessageAttachments';
import { MessageContent } from './MessageContent';
import { MessageReactions } from './MessageReactions';
import { MessageReply } from './MessageReply';

export interface MessageProps {
  message: Message;
  serverId: string;
  members: ServerMember[];
  channels: Channel[];
  /** True for the first message under a heading, which is where the reply line goes. */
  isLeading: boolean;
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
  isLeading,
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
    <div className="group relative">
      {!isEditing && (
        <MessageActions
          onReply={canReply ? () => onReply(message) : undefined}
          onReact={canReact ? (emoji) => onReact(message, emoji) : undefined}
          onEdit={canEdit ? () => setDraft(message.content) : undefined}
          onDelete={canDelete ? () => onDelete(message) : undefined}
          onCopy={() => void navigator.clipboard?.writeText(message.content)}
        />
      )}

      {isLeading && message.replyTo && <MessageReply replyTo={message.replyTo} />}

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

      <MessageReactions
        reactions={message.reactions}
        onToggle={canReact ? (emoji) => onReact(message, emoji) : undefined}
      />
    </div>
  );
}
