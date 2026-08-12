import { Link } from '@tanstack/react-router';

import type { Channel, Mention, ServerMember } from '@nestcord/shared';

import { renderMarkdown } from '@/lib/markdown';
import { cn } from '@/lib/utils';

interface MessageContentProps {
  content: string;
  /** Members of this server, so a mention only lights up for someone who exists. */
  members: ServerMember[];
  /** Channels the reader can see, so `#channel` only links where they can go. */
  channels: Channel[];
  serverId: string;
  className?: string;
}

/**
 * Message text: markdown, then mentions resolved against who and what is really here.
 *
 * An unresolvable mention stays plain text. That is the honest rendering — `@nobody`
 * did not notify anyone, and showing it as a mention would suggest it had.
 */
export function MessageContent({
  content,
  members,
  channels,
  serverId,
  className,
}: MessageContentProps) {
  const renderMention = (mention: Mention, key: string) => {
    if (mention.type === 'everyone') {
      return <MentionPill key={key}>@everyone</MentionPill>;
    }

    if (mention.type === 'channel') {
      const channel = channels.find(
        (candidate) =>
          candidate.type !== 'CATEGORY' &&
          candidate.name.toLowerCase() === mention.name.toLowerCase(),
      );

      if (!channel) return `#${mention.name}`;

      return (
        <Link
          key={key}
          to="/app/$serverId/$channelId"
          params={{ serverId, channelId: channel.id }}
          className="bg-primary/15 text-primary hover:bg-primary/25 rounded px-1 font-medium transition-colors"
        >
          #{channel.name}
        </Link>
      );
    }

    const member = members.find(
      (candidate) => candidate.user.username.toLowerCase() === mention.name.toLowerCase(),
    );

    if (!member) return `@${mention.name}`;

    return <MentionPill key={key}>@{member.nickname ?? member.user.username}</MentionPill>;
  };

  return (
    <span className={cn('break-words whitespace-pre-wrap', className)}>
      {renderMarkdown(content, { renderMention })}
    </span>
  );
}

function MentionPill({ children }: { children: React.ReactNode }) {
  return <span className="bg-primary/15 text-primary rounded px-1 font-medium">{children}</span>;
}
