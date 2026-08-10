import type { PresenceStatus } from '@nestcord/shared';

import { cn } from '@/lib/utils';

const STATUS_STYLES: Record<PresenceStatus, string> = {
  ONLINE: 'bg-online',
  IDLE: 'bg-idle',
  DO_NOT_DISTURB: 'bg-dnd',
  OFFLINE: 'bg-content-500',
};

const STATUS_LABELS: Record<PresenceStatus, string> = {
  ONLINE: 'Online',
  IDLE: 'Idle',
  DO_NOT_DISTURB: 'Do not disturb',
  OFFLINE: 'Offline',
};

interface PresenceDotProps {
  status: PresenceStatus;
  className?: string;
}

export function PresenceDot({ status, className }: PresenceDotProps) {
  return (
    <span
      role="img"
      aria-label={STATUS_LABELS[status]}
      className={cn(
        'border-surface-800 inline-block size-3 shrink-0 rounded-full border-2',
        STATUS_STYLES[status],
        className,
      )}
    />
  );
}
