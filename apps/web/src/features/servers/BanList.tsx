import type { ServerBan } from '@nestcord/shared';

import { UserAvatar } from '@/components/UserAvatar';
import { Button } from '@/components/ui/button';
import { FormStatus } from '@/features/settings/SettingsPrimitives';
import { useBans, useUnbanMember } from './use-servers';

/** Everyone barred from the server, with the reason and a way to let them back in. */
export function BanList({ serverId }: { serverId: string }) {
  const { data: bans, isPending, isError } = useBans(serverId);
  const unban = useUnbanMember(serverId);

  if (isPending) {
    return (
      <ul aria-label="Loading bans" className="space-y-2">
        {[0, 1, 2].map((slot) => (
          <li key={slot} className="bg-surface-700/60 h-14 animate-pulse rounded-xl" />
        ))}
      </ul>
    );
  }

  if (isError) {
    return (
      <p role="alert" className="text-destructive text-sm">
        Could not load the ban list.
      </p>
    );
  }

  if (bans.length === 0) {
    return <p className="text-content-400 text-sm">Nobody is banned from this server.</p>;
  }

  return (
    <div className="space-y-4">
      <ul aria-label="Bans" className="space-y-2">
        {bans.map((ban) => (
          <li key={ban.user.id}>
            <BanRow
              ban={ban}
              isPending={unban.isPending && unban.variables === ban.user.id}
              onUnban={() => unban.mutate(ban.user.id)}
            />
          </li>
        ))}
      </ul>

      <FormStatus error={unban.error} />
    </div>
  );
}

function BanRow({
  ban,
  isPending,
  onUnban,
}: {
  ban: ServerBan;
  isPending: boolean;
  onUnban: () => void;
}) {
  const name = ban.user.displayName ?? ban.user.username;

  return (
    <div className="bg-surface-900/40 flex items-center gap-3 rounded-xl px-3 py-2.5">
      <UserAvatar user={ban.user} size="md" />

      <div className="min-w-0 flex-1">
        <p className="truncate text-sm">{name}</p>
        <p className="text-content-500 truncate text-xs">
          {ban.reason ?? 'No reason given'}
          {ban.issuer && ` — by ${ban.issuer.displayName ?? ban.issuer.username}`}
        </p>
      </div>

      <Button variant="ghost" size="sm" onClick={onUnban} disabled={isPending}>
        Lift ban
      </Button>
    </div>
  );
}
