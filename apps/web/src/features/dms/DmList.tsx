import { Link } from '@tanstack/react-router';
import { UsersRound } from 'lucide-react';

import type { Conversation } from '@nestcord/shared';

import { QueryError } from '@/components/QueryError';
import { UserAvatar } from '@/components/UserAvatar';
import { cn } from '@/lib/utils';
import { conversationAvatar, conversationTitle } from './conversation-title';
import { useConversations } from './use-conversations';

/**
 * The conversation list in the `@me` sidebar (PLAN.MD §19).
 *
 * Ordered by the server, most recently active first, so the DM you are in the middle
 * of is always the one at the top.
 */
export function DmList({
  viewerId,
  activeConversationId,
}: {
  viewerId: string;
  activeConversationId: string | undefined;
}) {
  const { data: conversations, isPending, isError, refetch } = useConversations();

  if (isPending) {
    return (
      <p className="text-content-500 px-2.5 pt-4 text-sm" role="status">
        Loading conversations…
      </p>
    );
  }

  if (isError || !conversations) {
    return (
      <QueryError
        what="your conversations"
        onRetry={() => void refetch()}
        className="px-2.5 pt-4"
      />
    );
  }

  if (conversations.length === 0) {
    return (
      <p className="text-content-500 px-2.5 pt-4 text-xs">
        No conversations yet — start one from the friends page.
      </p>
    );
  }

  return (
    <div className="pt-4">
      <h2 className="text-content-500 px-2.5 pb-1.5 text-xs font-medium uppercase">
        Direct messages
      </h2>

      <ul>
        {conversations.map((conversation) => (
          <li key={conversation.id}>
            <DmLink
              conversation={conversation}
              viewerId={viewerId}
              isActive={conversation.id === activeConversationId}
            />
          </li>
        ))}
      </ul>
    </div>
  );
}

function DmLink({
  conversation,
  viewerId,
  isActive,
}: {
  conversation: Conversation;
  viewerId: string;
  isActive: boolean;
}) {
  const other = conversationAvatar(conversation, viewerId);

  return (
    <Link
      to="/app/@me/$conversationId"
      params={{ conversationId: conversation.id }}
      className={cn(
        'text-content-300 hover:bg-surface-700 hover:text-content-100 flex items-center gap-2 rounded-lg px-2.5 py-1.5 text-sm transition-colors',
        isActive && 'bg-surface-600 text-content-100',
      )}
    >
      {other ? (
        <UserAvatar user={other} size="sm" status={other.status} />
      ) : (
        <span className="bg-surface-600 flex size-6 shrink-0 items-center justify-center rounded-full">
          <UsersRound className="text-content-400 size-3.5" aria-hidden />
        </span>
      )}

      <span className="truncate">{conversationTitle(conversation, viewerId)}</span>
    </Link>
  );
}
