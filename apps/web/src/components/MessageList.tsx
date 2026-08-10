import { placeholderMessages, type PlaceholderMessage } from '../features/placeholder-data';

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

  return (
    <div className="flex-1 overflow-y-auto px-4 py-4">
      <div className="mb-6">
        <h2 className="text-2xl font-bold">Welcome to #general</h2>
        <p className="text-content-300 text-sm">
          This is the start of the channel. Messages are placeholder data until the messaging API
          lands.
        </p>
      </div>

      <ul className="space-y-4">
        {groups.map((group) => (
          <li key={`${group.author}-${group.timestamp}`} className="flex gap-3">
            <div className="bg-surface-600 mt-0.5 grid size-10 shrink-0 place-items-center rounded-full text-sm font-semibold uppercase">
              {group.author.slice(0, 2)}
            </div>
            <div className="min-w-0 flex-1">
              <p className="flex items-baseline gap-2">
                <span className="font-medium">{group.author}</span>
                <time className="text-content-500 text-xs">{group.timestamp}</time>
              </p>
              {group.messages.map((message) => (
                <p key={message.id} className="text-content-100 break-words">
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
