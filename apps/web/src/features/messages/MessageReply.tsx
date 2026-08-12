import { CornerLeftUp } from 'lucide-react';

import type { MessageReference } from '@nestcord/shared';

import { UserAvatar } from '@/components/UserAvatar';

/**
 * The one line above a reply showing what it answers.
 *
 * Only a line of it: a reply that reprinted the whole quoted message would bury the
 * reply itself. The text is deliberately unformatted — markdown in a one-line preview
 * is noise, and it is already rendered properly further up the channel.
 */
export function MessageReply({ replyTo }: { replyTo: MessageReference }) {
  return (
    <p className="text-content-400 mb-0.5 flex items-center gap-1.5 text-xs">
      <CornerLeftUp className="size-3.5 shrink-0" aria-hidden />
      <UserAvatar user={replyTo.author} size="sm" className="size-4 text-[0.5rem]" />
      <span className="text-content-200 font-medium">
        {replyTo.author.displayName ?? replyTo.author.username}
      </span>
      <span className="truncate">{replyTo.content || 'sent an attachment'}</span>
    </p>
  );
}
