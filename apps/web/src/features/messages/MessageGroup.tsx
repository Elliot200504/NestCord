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
  /** Set while a message here is ringed after being travelled to. */
  flashingId: string | null;
  /** False when the quoted message is not loaded, so there is nothing to travel to. */
  canJumpTo: (messageId: string) => boolean;
  onJump: (messageId: string) => void;
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
  flashingId,
  canJumpTo,
  onJump,
  onReply,
  onReact,
  onEdit,
  onDelete,
}: MessageGroupProps) {
  const first = group.messages[0];
  // Hoisted so the jump callback narrows without a non-null assertion.
  const leadingReply = first?.replyTo ?? null;
  const nickname = members.find((member) => member.user.id === group.author.id)?.nickname;
  const name = nickname ?? group.author.displayName ?? group.author.username;

  return (
    <li
      className={cn(
        // Named so the leading message's actions can respond to a hover anywhere in
        // the block — the quote and the author line included.
        'group/block hover:bg-surface-600/20 rounded-xl px-3 transition-colors',
        isCompact ? 'py-1' : 'py-2',
      )}
    >
      {/* A reply always leads its own group, so the quote sits at the top of the
          block — above the responder's avatar and name — indented to line up with
          the words it is being answered by. */}
      {leadingReply && (
        <MessageReply
          replyTo={leadingReply}
          onJump={canJumpTo(leadingReply.id) ? () => onJump(leadingReply.id) : undefined}
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
              revealOnBlockHover={group.messages.length === 1}
              isFlashing={flashingId === message.id}
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
