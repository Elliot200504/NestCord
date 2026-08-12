import { CornerLeftDown } from 'lucide-react';

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
 *
 * The whole quote is a button: clicking it travels to the message being answered.
 */
export function MessageReply({
  replyTo,
  onJump,
  className,
}: {
  replyTo: MessageReference;
  /** Scrolls to the quoted message. Absent when it is not on screen to travel to. */
  onJump?: () => void;
  className?: string;
}) {
  const name = replyTo.author.displayName ?? replyTo.author.username;

  return (
    <button
      type="button"
      onClick={onJump}
      disabled={!onJump}
      aria-label={`Go to ${name}’s message`}
      className={cn(
        // `block` without `w-full`: with a left margin, a full width would overflow
        // the container and put a horizontal scrollbar under the channel.
        'border-border mb-1 block border-l-2 pl-2.5 text-left text-xs',
        onJump && 'hover:border-primary/60 cursor-pointer',
        className,
      )}
    >
      <span className="flex items-center gap-1.5">
        {/* Pointing down, from the message being answered to the answer below it. */}
        <CornerLeftDown className="text-content-500 size-3.5 shrink-0" aria-hidden />
        <UserAvatar user={replyTo.author} size="xs" />
        <span
          className="text-primary font-medium"
          style={replyTo.author.accentColor ? { color: replyTo.author.accentColor } : undefined}
        >
          {name}
        </span>
      </span>
      <span className="text-content-400 block truncate pl-[1.4rem]">
        {replyTo.content || 'sent an attachment'}
      </span>
    </button>
  );
}
