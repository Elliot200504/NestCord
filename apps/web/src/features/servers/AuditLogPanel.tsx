import type { AuditAction, AuditLogEntry } from '@nestcord/shared';

import { UserAvatar } from '@/components/UserAvatar';
import { useAuditLog } from './use-servers';

/** What each action reads as, in the past tense the log is written in. */
const ACTION_LABELS: Record<AuditAction, string> = {
  MEMBER_KICK: 'kicked',
  MEMBER_BAN: 'banned',
  MEMBER_UNBAN: 'lifted the ban on',
  MESSAGE_DELETE: 'deleted a message',
  CHANNEL_CREATE: 'created a channel',
  CHANNEL_DELETE: 'deleted a channel',
  ROLE_CREATE: 'created a role',
  ROLE_DELETE: 'deleted a role',
};

/** Recent moderation actions, newest first. */
export function AuditLogPanel({ serverId }: { serverId: string }) {
  const { data: entries, isPending, isError } = useAuditLog(serverId);

  if (isPending) {
    return (
      <ul aria-label="Loading the audit log" className="space-y-2">
        {[0, 1, 2, 3].map((slot) => (
          <li key={slot} className="bg-surface-700/60 h-12 animate-pulse rounded-xl" />
        ))}
      </ul>
    );
  }

  if (isError) {
    return (
      <p role="alert" className="text-destructive text-sm">
        Could not load the audit log.
      </p>
    );
  }

  if (entries.length === 0) {
    return <p className="text-content-400 text-sm">Nothing has been moderated yet.</p>;
  }

  return (
    <ul aria-label="Audit log" className="space-y-2">
      {entries.map((entry) => (
        <li key={entry.id}>
          <AuditRow entry={entry} />
        </li>
      ))}
    </ul>
  );
}

function AuditRow({ entry }: { entry: AuditLogEntry }) {
  const actor = entry.actor.displayName ?? entry.actor.username;
  const target = entry.targetUser
    ? (entry.targetUser.displayName ?? entry.targetUser.username)
    : null;

  return (
    <div className="bg-surface-900/40 flex items-center gap-3 rounded-xl px-3 py-2.5">
      <UserAvatar user={entry.actor} size="sm" />

      <div className="min-w-0 flex-1">
        <p className="truncate text-sm">
          <span className="font-medium">{actor}</span> {ACTION_LABELS[entry.action]}
          {target && ` ${target}`}
        </p>
        {entry.reason && <p className="text-content-500 truncate text-xs">{entry.reason}</p>}
      </div>

      <time dateTime={entry.createdAt} className="text-content-500 shrink-0 text-xs">
        {new Date(entry.createdAt).toLocaleString()}
      </time>
    </div>
  );
}
