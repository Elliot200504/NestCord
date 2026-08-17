import { useEffect, useRef, useState } from 'react';

import type { Conversation, Message } from '@nestcord/shared';

import { BrandMark } from '@/components/BrandMark';
import { QueryError } from '@/components/QueryError';
import { messageAnchorId } from '@/features/messages/message-anchor';
import { groupMessages } from '@/features/messages/message-grouping';
import { MessageGroupBlock } from '@/features/messages/MessageGroup';
import {
  flattenMessages,
  useDeleteMessage,
  useEditMessage,
  useMessages,
  useToggleReaction,
} from '@/features/messages/use-messages';
import { useAppearanceStore } from '@/stores/appearance-store';
import { useUiStore } from '@/stores/ui-store';
import { conversationMessages } from './api';
import { conversationTitle } from './conversation-title';

/**
 * A conversation's history (PLAN.MD §19).
 *
 * The messages themselves are rendered by the same components a channel uses — this
 * differs only in what it is allowed to say about permissions. In a DM everyone in it
 * may send and react, and nobody may touch anyone else's message, so the flags the
 * group block takes are constants here rather than a resolved bitfield.
 */
export function DmMessageList({
  conversation,
  viewerId,
}: {
  conversation: Conversation;
  viewerId: string;
}) {
  const transport = conversationMessages(conversation.id);
  const { data, isPending, isError, refetch, fetchNextPage, hasNextPage, isFetchingNextPage } =
    useMessages(transport);

  const isCompact = useAppearanceStore((state) => state.density) === 'compact';
  const startReply = useUiStore((state) => state.startReply);

  const toggleReaction = useToggleReaction(transport);
  const editMessage = useEditMessage(transport);
  const deleteMessage = useDeleteMessage(transport);

  const messages = flattenMessages(data?.pages);
  const groups = groupMessages(messages);
  const loadedIds = new Set(messages.map((message) => message.id));
  const newestId = messages.at(-1)?.id;

  const bottom = useRef<HTMLDivElement>(null);
  const [flashingId, setFlashingId] = useState<string | null>(null);

  function jumpTo(messageId: string) {
    document.getElementById(messageAnchorId(messageId))?.scrollIntoView({
      block: 'center',
      behavior: 'smooth',
    });

    setFlashingId(messageId);
  }

  useEffect(() => {
    if (!flashingId) return;

    const timer = setTimeout(() => setFlashingId(null), 1500);

    return () => clearTimeout(timer);
  }, [flashingId]);

  useEffect(() => {
    bottom.current?.scrollIntoView({ block: 'end' });
  }, [newestId]);

  if (isPending) {
    return (
      <div className="flex-1 overflow-y-auto px-6 py-5">
        <ul aria-label="Loading messages" className="space-y-4">
          {[0, 1, 2, 3, 4].map((slot) => (
            <li key={slot} className="flex gap-3">
              <span className="bg-surface-700/60 size-10 shrink-0 animate-pulse rounded-full" />
              <span className="flex-1 space-y-2">
                <span className="bg-surface-700/60 block h-3 w-28 animate-pulse rounded" />
                <span className="bg-surface-700/60 block h-3 w-2/3 animate-pulse rounded" />
              </span>
            </li>
          ))}
        </ul>
      </div>
    );
  }

  if (isError) {
    return (
      <QueryError
        what="this conversation"
        onRetry={() => void refetch()}
        className="flex-1 px-6 py-8"
      />
    );
  }

  const title = conversationTitle(conversation, viewerId);

  return (
    <div className="flex-1 overflow-y-auto px-3 py-5">
      {hasNextPage ? (
        <div className="mb-4 flex justify-center">
          <button
            type="button"
            onClick={() => void fetchNextPage()}
            disabled={isFetchingNextPage}
            className="bg-surface-700 text-content-200 hover:text-content-100 rounded-full px-4 py-1.5 text-xs transition-colors disabled:opacity-60"
          >
            {isFetchingNextPage ? 'Loading…' : 'Load older messages'}
          </button>
        </div>
      ) : (
        <div className="mb-8 px-3">
          <BrandMark size="lg" className="mb-4" />
          <h2 className="font-display text-2xl font-semibold">{title}</h2>
          <p className="text-content-300 mt-1 max-w-prose text-sm">
            {conversation.isGroup
              ? 'This is the start of your group.'
              : `This is the start of your conversation with ${title}.`}
          </p>
        </div>
      )}

      {messages.length === 0 && (
        <p className="text-content-400 px-3 text-sm">Say the first thing.</p>
      )}

      <ul>
        {groups.map((group) => (
          <MessageGroupBlock
            key={group.id}
            group={group}
            // There is no server behind a DM, so mention links have nowhere to point.
            // `@me` keeps the router happy and the empty lists mean nothing resolves.
            serverId="@me"
            members={[]}
            channels={[]}
            viewerId={viewerId}
            canSend
            canReact
            // A DM has no moderator: only the author can remove their own message,
            // which the message component already allows on top of this flag.
            canManage={false}
            isCompact={isCompact}
            flashingId={flashingId}
            canJumpTo={(messageId) => loadedIds.has(messageId)}
            onJump={jumpTo}
            onReply={(message: Message) =>
              startReply(conversation.id, {
                messageId: message.id,
                author: message.author.displayName ?? message.author.username,
              })
            }
            onReact={(message, emoji) => toggleReaction.mutate({ message, emoji })}
            onEdit={(message, content) => editMessage.mutate({ messageId: message.id, content })}
            onDelete={(message) => deleteMessage.mutate(message.id)}
          />
        ))}
      </ul>

      {(toggleReaction.isError || editMessage.isError || deleteMessage.isError) && (
        <p role="alert" className="text-destructive px-3 pt-2 text-sm">
          That did not go through. Nothing was changed.
        </p>
      )}

      <div ref={bottom} />
    </div>
  );
}
