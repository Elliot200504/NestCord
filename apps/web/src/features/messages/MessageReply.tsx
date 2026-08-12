import { CornerLeftUp } from 'lucide-react';

import type { MessageReference } from '@nestcord/shared';

import { UserAvatar } from '@/components/UserAvatar';
import { cn } from '@/lib/utils';

/**
 * What a reply is answering, quoted above the whole reply — above the responder's own
 * avatar and name, not tucked beside their words.
 *
 * Who said it goes on its own line above the words they said, so the quote reads as a
 * small message rather than a run-on sentence starting with a name. The name takes the
 * author's accent colour, which separates it from the quoted text and matches how they
 * appear everywhere else.
 */
export function MessageReply({
  replyTo,
  className,
}: {
  replyTo: MessageReference;
  className?: string;
}) {
  const name = replyTo.author.displayName ?? replyTo.author.username;

  return (
    <div className={cn('border-border mb-1 border-l-2 pl-2.5 text-xs', className)}>
      <p className="flex items-center gap-1.5">
        <CornerLeftUp className="text-content-500 size-3.5 shrink-0" aria-hidden />
        <UserAvatar user={replyTo.author} size="xs" />
        <span
          className="text-primary font-medium"
          style={replyTo.author.accentColor ? { color: replyTo.author.accentColor } : undefined}
        >
          {name}
        </span>
      </p>
      <p className="text-content-400 truncate pl-[1.4rem]">
        {replyTo.content || 'sent an attachment'}
      </p>
    </div>
  );
}
