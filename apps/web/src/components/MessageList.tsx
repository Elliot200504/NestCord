import { placeholderMessages, type PlaceholderMessage } from '../features/placeholder-data';
import { useAppearanceStore } from '@/stores/appearance-store';
import { BrandMark } from './BrandMark';
import { UserAvatar } from './UserAvatar';
import { cn } from '@/lib/utils';

interface MessageGroup {
  author: string;
  timestamp: string;
  messages: PlaceholderMessage[];
}

/** Consecutive messages from the same author render as one group. */
function groupMessages(messages: PlaceholderMessage[]): MessageGroup[] {
  return messages.reduce<MessageGroup[]>((groups, message) => {
    const last = groups.at(-1);

    if (last && last.author === message.author) {
      return [...groups.slice(0, -1), { ...last, messages: [...last.messages, message] }];
    }

    return [
      ...groups,
      { author: message.author, timestamp: message.timestamp, messages: [message] },
    ];
  }, []);
}

export function MessageList() {
  const groups = groupMessages(placeholderMessages);
  const isCompact = useAppearanceStore((state) => state.density) === 'compact';

  return (
    <div className="flex-1 overflow-y-auto px-3 py-5">
      {/* The top of a channel is the one place worth a bit of warmth. */}
      <div className="mb-8 px-3">
        <BrandMark size="lg" className="mb-4" />
        <h2 className="font-display text-2xl font-semibold">This is the start of #general</h2>
        <p className="text-content-300 mt-1 max-w-prose text-sm">
          Everything said here stays here. Messages are placeholder data until the messaging API
          lands.
        </p>
      </div>

      <ul>
        {groups.map((group) => (
          <li
            key={`${group.author}-${group.timestamp}`}
            className={cn(
              'hover:bg-surface-600/35 flex gap-3 rounded-xl px-3 transition-colors',
              isCompact ? 'py-1' : 'py-2',
            )}
          >
            <UserAvatar
              user={{
                username: group.author,
                displayName: null,
                avatarUrl: null,
                accentColor: null,
              }}
              size={isCompact ? 'md' : 'lg'}
              className="mt-0.5"
            />
            <div className="min-w-0 flex-1">
              <p className="flex items-baseline gap-2">
                <span className="font-medium">{group.author}</span>
                <time className="text-content-500 text-xs">{group.timestamp}</time>
              </p>
              {group.messages.map((message) => (
                <p
                  key={message.id}
                  className={cn(
                    'text-content-100 break-words',
                    isCompact ? 'leading-snug' : 'leading-relaxed',
                  )}
                >
                  {message.content}
                </p>
              ))}
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
