import { Hash, Users } from 'lucide-react';

import { useUiStore } from '../stores/ui-store';
import { ApiStatusBadge } from './ApiStatusBadge';

interface ChannelHeaderProps {
  channelName: string;
  topic?: string;
}

export function ChannelHeader({ channelName, topic }: ChannelHeaderProps) {
  const toggleMemberList = useUiStore((state) => state.toggleMemberList);

  return (
    <header className="border-border flex h-14 shrink-0 items-center gap-2 border-b px-4">
      <Hash className="text-content-500 size-4.5" aria-hidden />
      <h1 className="font-display text-base font-semibold">{channelName}</h1>

      {topic && (
        <>
          <span className="bg-border mx-2.5 h-5 w-px" />
          <p className="text-content-500 truncate text-sm">{topic}</p>
        </>
      )}

      <div className="ml-auto flex items-center gap-3">
        <ApiStatusBadge />
        <button
          type="button"
          onClick={toggleMemberList}
          aria-label="Toggle member list"
          className="text-content-300 hover:text-content-100 transition-colors"
        >
          <Users className="size-5" aria-hidden />
        </button>
      </div>
    </header>
  );
}
