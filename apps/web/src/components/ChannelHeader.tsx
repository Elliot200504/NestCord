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
    <header className="border-border flex h-12 shrink-0 items-center gap-2 border-b px-4 shadow-sm">
      <Hash className="text-content-500 size-5" aria-hidden />
      <h1 className="font-semibold">{channelName}</h1>

      {topic && (
        <>
          <span className="bg-surface-600 mx-2 h-6 w-px" />
          <p className="text-content-300 truncate text-sm">{topic}</p>
        </>
      )}

      <div className="ml-auto flex items-center gap-3">
        <ApiStatusBadge />
        <button
          type="button"
          onClick={toggleMemberList}
          aria-label="Toggle member list"
          className="text-content-300 hover:text-white"
        >
          <Users className="size-5" aria-hidden />
        </button>
      </div>
    </header>
  );
}
