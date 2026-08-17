import { useEffect, useRef, useState } from 'react';

import { has, Permission, type Channel, type Message } from '@nestcord/shared';

import { BrandMark } from '@/components/BrandMark';
import { QueryError } from '@/components/QueryError';
import { useChannels } from '@/features/channels/use-channels';
import { useMembers } from '@/features/servers/use-servers';
import { useAppearanceStore } from '@/stores/appearance-store';
import { useUiStore } from '@/stores/ui-store';
import { channelMessages } from './api';
import { messageAnchorId } from './message-anchor';
import {
  flattenMessages,
  useDeleteMessage,
  useEditMessage,
  useMessages,
  useToggleReaction,
} from './use-messages';
import { groupMessages } from './message-grouping';
import { MessageGroupBlock } from './MessageGroup';

interface MessageListProps {
  serverId: string;
  channel: Channel;
  viewerId: string;
}

/**
 * A channel's history (PLAN.MD §15).
 *
 * Older messages are fetched on request rather than on scroll: a button is one line of
 * code and cannot fight the browser for the scroll position, which an auto-loader at
 * the top of a reversed list very much can.
 */
export function MessageList({ serverId, channel, viewerId }: MessageListProps) {
  const transport = channelMessages(serverId, channel.id);
  const { data, isPending, isError, refetch, fetchNextPage, hasNextPage, isFetchingNextPage } =
    useMessages(transport);

  const { data: members } = useMembers(serverId);
  const { data: channels } = useChannels(serverId);
  const isCompact = useAppearanceStore((state) => state.density) === 'compact';
  const startReply = useUiStore((state) => state.startReply);

  const toggleReaction = useToggleReaction(transport);
  const editMessage = useEditMessage(transport);
  const deleteMessage = useDeleteMessage(transport);

  const messages = flattenMessages(data?.pages);
  const groups = groupMessages(messages);
  // Only a loaded message can be travelled to; the quote is inert for the rest.
  const loadedIds = new Set(messages.map((message) => message.id));
  const newestId = messages.at(-1)?.id;

  const bottom = useRef<HTMLDivElement>(null);
  const [flashingId, setFlashingId] = useState<string | null>(null);

  /**
   * Travels to the message a reply is answering.
   *
   * It is only reachable if it is already loaded — an older message the reader has not
   * scrolled back to has nothing to scroll to yet, so the quote is left inert rather
   * than fetching pages until it turns up.
   */
  function jumpTo(messageId: string) {
    document.getElementById(messageAnchorId(messageId))?.scrollIntoView({
      block: 'center',
      behavior: 'smooth',
    });

    setFlashingId(messageId);
  }

  // The ring is a nudge, not a state to sit in, so it clears itself.
  useEffect(() => {
    if (!flashingId) return;

    const timer = setTimeout(() => setFlashingId(null), 1500);

    return () => clearTimeout(timer);
  }, [flashingId]);

  // Following the conversation is the whole point of a chat window, so a new message
  // scrolls it into view. Fetching older pages does not change the newest id, so
  // scrolling up to read history is left alone.
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
        what={`the messages in #${channel.name}`}
        onRetry={() => void refetch()}
        className="flex-1 px-6 py-8"
      />
    );
  }

  const canSend = has(channel.permissions, Permission.SEND_MESSAGES);
  const canReact = has(channel.permissions, Permission.ADD_REACTIONS);
  const canManage = has(channel.permissions, Permission.MANAGE_MESSAGES);

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
          <h2 className="font-display text-2xl font-semibold">
            This is the start of #{channel.name}
          </h2>
          <p className="text-content-300 mt-1 max-w-prose text-sm">
            {channel.topic ?? 'Everything said here stays here.'}
          </p>
        </div>
      )}

      {messages.length === 0 && (
        <p className="text-content-400 px-3 text-sm">
          {canSend ? 'Say the first thing.' : 'Nothing has been said here yet.'}
        </p>
      )}

      <ul>
        {groups.map((group) => (
          <MessageGroupBlock
            key={group.id}
            group={group}
            serverId={serverId}
            members={members ?? []}
            channels={channels ?? []}
            viewerId={viewerId}
            canSend={canSend}
            canReact={canReact}
            canManage={canManage}
            isCompact={isCompact}
            flashingId={flashingId}
            canJumpTo={(messageId) => loadedIds.has(messageId)}
            onJump={jumpTo}
            onReply={(message: Message) =>
              startReply(channel.id, {
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
