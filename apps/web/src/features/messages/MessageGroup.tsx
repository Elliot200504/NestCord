import type { Channel, Message, ServerMember } from '@nestcord/shared';

import { UserAvatar } from '@/components/UserAvatar';
import { cn } from '@/lib/utils';
import { formatFullTime, formatTime, type MessageGroup } from './message-grouping';
import { MessageRow } from './Message';
import { MessageReply } from './MessageReply';

interface MessageGroupProps {
  group: MessageGroup;
  serverId: string;
  members: ServerMember[];
  channels: Channel[];
  /** The reader, so their own messages get the edit and delete actions. */
  viewerId: string;
  canSend: boolean;
  canReact: boolean;
  canManage: boolean;
  isCompact: boolean;
  onReply: (message: Message) => void;
  onReact: (message: Message, emoji: string) => void;
  onEdit: (message: Message, content: string) => void;
  onDelete: (message: Message) => void;
}

/** One author's run of messages under a single avatar, name and timestamp. */
export function MessageGroupBlock({
  group,
  serverId,
  members,
  channels,
  viewerId,
  canSend,
  canReact,
  canManage,
  isCompact,
  onReply,
  onReact,
  onEdit,
  onDelete,
}: MessageGroupProps) {
  const first = group.messages[0];
  const nickname = members.find((member) => member.user.id === group.author.id)?.nickname;
  const name = nickname ?? group.author.displayName ?? group.author.username;

  return (
    <li
      className={cn(
        'hover:bg-surface-600/20 rounded-xl px-3 transition-colors',
        isCompact ? 'py-1' : 'py-2',
      )}
    >
      {/* A reply always leads its own group, so the quote sits at the top of the
          block — above the responder's avatar and name — indented to line up with
          the words it is being answered by. */}
      {first?.replyTo && (
        <MessageReply
          replyTo={first.replyTo}
          className={isCompact ? 'ml-[2.75rem]' : 'ml-[3.25rem]'}
        />
      )}

      <div className="flex gap-3">
        {/* No presence dot here: it belongs where you go to see who is around, not
            repeated down every message in the channel. */}
        <UserAvatar
          user={group.author}
          size={isCompact ? 'md' : 'lg'}
          className="mt-0.5 shrink-0"
        />

        <div className="min-w-0 flex-1">
          <p className="flex items-baseline gap-2">
            <span className="font-medium">{name}</span>
            {first && (
              <time
                dateTime={first.createdAt}
                title={formatFullTime(first.createdAt)}
                className="text-content-500 text-xs"
              >
                {formatTime(first.createdAt)}
              </time>
            )}
          </p>

          {group.messages.map((message) => (
            <MessageRow
              key={message.id}
              message={message}
              serverId={serverId}
              members={members}
              channels={channels}
              canReply={canSend}
              canReact={canReact}
              // Only ever your own words: MANAGE_MESSAGES can remove a message but
              // never rewrite one, and the API enforces the same rule.
              canEdit={message.author.id === viewerId}
              canDelete={message.author.id === viewerId || canManage}
              onReply={onReply}
              onReact={onReact}
              onEdit={onEdit}
              onDelete={onDelete}
            />
          ))}
        </div>
      </div>
    </li>
  );
}
