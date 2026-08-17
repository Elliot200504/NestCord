import { AtSign, LogOut, UsersRound } from 'lucide-react';
import { useNavigate } from '@tanstack/react-router';

import type { Conversation } from '@nestcord/shared';

import { ApiStatusBadge } from '@/components/ApiStatusBadge';
import { OpenChannelsButton } from '@/components/ShellButtons';
import { NotificationBell } from '@/features/notifications/NotificationBell';
import { conversationTitle, otherParticipants } from './conversation-title';
import { useLeaveConversation } from './use-conversations';

/**
 * The bar above a DM. It says who you are talking to, and — for a group — offers the
 * one action a group has that a pair does not: leaving it.
 */
export function DmHeader({
  conversation,
  viewerId,
}: {
  conversation: Conversation;
  viewerId: string;
}) {
  const navigate = useNavigate();
  const leave = useLeaveConversation(conversation.id);

  const title = conversationTitle(conversation, viewerId);
  const others = otherParticipants(conversation, viewerId);

  return (
    <header className="border-border flex h-14 shrink-0 items-center gap-2 border-b px-4">
      <OpenChannelsButton />
      {conversation.isGroup ? (
        <UsersRound className="text-content-500 size-4.5 shrink-0" aria-hidden />
      ) : (
        <AtSign className="text-content-500 size-4.5 shrink-0" aria-hidden />
      )}
      <h1 className="font-display truncate text-base font-semibold">{title}</h1>

      {conversation.isGroup && (
        <span className="hidden min-w-0 items-center md:flex">
          <span className="bg-border mx-2.5 h-5 w-px" />
          <span className="text-content-500 truncate text-sm">{others.length + 1} people</span>
        </span>
      )}

      <div className="ml-auto flex shrink-0 items-center gap-3">
        <ApiStatusBadge />
        <NotificationBell />

        {conversation.isGroup && (
          <button
            type="button"
            disabled={leave.isPending}
            onClick={() =>
              leave.mutate(undefined, {
                // Staying on a conversation you just left would show a dead view.
                onSuccess: () => void navigate({ to: '/app/@me/friends' }),
              })
            }
            aria-label="Leave this group"
            className="text-content-300 hover:text-destructive transition-colors disabled:opacity-40"
          >
            <LogOut className="size-5" aria-hidden />
          </button>
        )}
      </div>
    </header>
  );
}
