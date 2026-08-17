import { Hash } from 'lucide-react';

import { NotificationBell } from '../features/notifications/NotificationBell';
import { ApiStatusBadge } from './ApiStatusBadge';
import { MemberListButton, OpenChannelsButton } from './ShellButtons';

interface ChannelHeaderProps {
  channelName: string;
  topic?: string;
}

export function ChannelHeader({ channelName, topic }: ChannelHeaderProps) {
  return (
    <header className="border-border flex h-14 shrink-0 items-center gap-2 border-b px-4">
      <OpenChannelsButton />
      <Hash className="text-content-500 size-4.5 shrink-0" aria-hidden />
      <h1 className="font-display truncate text-base font-semibold">{channelName}</h1>

      {/* The topic is the first thing to go when the bar gets narrow. */}
      {topic && (
        <span className="hidden min-w-0 items-center md:flex">
          <span className="bg-border mx-2.5 h-5 w-px" />
          <span className="text-content-500 truncate text-sm">{topic}</span>
        </span>
      )}

      <div className="ml-auto flex shrink-0 items-center gap-3">
        <ApiStatusBadge />
        <NotificationBell />
        <MemberListButton />
      </div>
    </header>
  );
}
