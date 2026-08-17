import { useState } from 'react';

import {
  has,
  Permission,
  type Channel,
  type ChannelOverride,
  type ServerRole,
} from '@nestcord/shared';

import { QueryError } from '@/components/QueryError';
import { Button } from '@/components/ui/button';
import { FormStatus } from '@/features/settings/SettingsPrimitives';
import { CHANNEL_PERMISSION_NAMES, PERMISSION_LABELS } from '@/lib/permission-labels';
import { cn } from '@/lib/utils';
import { useChannelOverrides, useSetRoleOverride } from './use-channels';

type Choice = 'allow' | 'neutral' | 'deny';

const CHOICES: { value: Choice; label: string }[] = [
  { value: 'deny', label: 'Deny' },
  { value: 'neutral', label: 'Inherit' },
  { value: 'allow', label: 'Allow' },
];

/**
 * Per-role overrides for one channel: allow, inherit or deny, the same three states
 * the API stores as two bitfields.
 */
export function ChannelPermissionsEditor({
  serverId,
  channel,
  roles,
  ownPermissions,
}: {
  serverId: string;
  channel: Channel;
  roles: ServerRole[];
  ownPermissions: number;
}) {
  const {
    data: overrides,
    isPending,
    isError,
    refetch,
  } = useChannelOverrides(serverId, channel.id);
  const [roleId, setRoleId] = useState(roles[0]?.id ?? '');

  if (isPending) return <p className="text-content-500 text-sm">Loading permissions…</p>;

  if (isError || !overrides) {
    return <QueryError what="this channel’s permissions" onRetry={() => void refetch()} />;
  }

  const selected = roles.find((role) => role.id === roleId) ?? roles[0];

  if (!selected) return <p className="text-content-500 text-sm">This server has no roles.</p>;

  return (
    <div className="grid gap-5 sm:grid-cols-[10rem_1fr]">
      <ul className="space-y-1">
        {roles.map((role) => (
          <li key={role.id}>
            <button
              type="button"
              onClick={() => setRoleId(role.id)}
              aria-current={selected.id === role.id}
              className={cn(
                'hover:bg-surface-700 flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-left text-sm transition-colors',
                selected.id === role.id && 'bg-surface-600',
              )}
            >
              <span
                aria-hidden
                className="size-2.5 shrink-0 rounded-full"
                style={{ backgroundColor: role.color ?? 'var(--color-content-500)' }}
              />
              <span className="truncate">{role.name}</span>
            </button>
          </li>
        ))}
      </ul>

      <OverrideForm
        key={selected.id}
        serverId={serverId}
        channelId={channel.id}
        role={selected}
        override={overrides.find((entry) => entry.roleId === selected.id) ?? null}
        ownPermissions={ownPermissions}
      />
    </div>
  );
}

function OverrideForm({
  serverId,
  channelId,
  role,
  override,
  ownPermissions,
}: {
  serverId: string;
  channelId: string;
  role: ServerRole;
  override: ChannelOverride | null;
  ownPermissions: number;
}) {
  const [allow, setAllow] = useState(override?.allow ?? 0);
  const [deny, setDeny] = useState(override?.deny ?? 0);
  const save = useSetRoleOverride(serverId, channelId);

  const isDirty = allow !== (override?.allow ?? 0) || deny !== (override?.deny ?? 0);

  function choose(flag: number, choice: Choice) {
    setAllow((current) => (choice === 'allow' ? current | flag : current & ~flag));
    setDeny((current) => (choice === 'deny' ? current | flag : current & ~flag));
  }

  return (
    <div className="space-y-4">
      <p className="text-content-500 text-sm">
        Inherit leaves the permission as {role.name} has it across the server.
      </p>

      <ul className="space-y-1">
        {CHANNEL_PERMISSION_NAMES.map((flagName) => {
          const flag = Permission[flagName];
          const current: Choice =
            (allow & flag) !== 0 ? 'allow' : (deny & flag) !== 0 ? 'deny' : 'neutral';
          // The API refuses to hand out a permission the caller does not hold here,
          // so the row is disabled rather than failing on save.
          const canGrant = has(ownPermissions, flag);

          return (
            <li
              key={flagName}
              className={cn(
                'flex items-center gap-3 rounded-lg px-2 py-1.5 text-sm',
                !canGrant && 'opacity-45',
              )}
            >
              <span className="flex-1">{PERMISSION_LABELS[flagName]}</span>

              <div role="group" aria-label={PERMISSION_LABELS[flagName]} className="flex gap-1">
                {CHOICES.map((choice) => (
                  <button
                    key={choice.value}
                    type="button"
                    aria-pressed={current === choice.value}
                    disabled={!canGrant || save.isPending}
                    onClick={() => choose(flag, choice.value)}
                    className={cn(
                      'border-border hover:border-content-500 rounded-lg border px-2 py-1 text-xs transition-colors',
                      current === choice.value && 'border-primary text-content-100',
                    )}
                  >
                    {choice.label}
                  </button>
                ))}
              </div>
            </li>
          );
        })}
      </ul>

      <div className="flex items-center justify-between gap-3">
        <FormStatus
          isPending={save.isPending}
          error={save.error}
          isSuccess={save.isSuccess && !isDirty}
        />
        <Button
          type="button"
          size="lg"
          disabled={!isDirty || save.isPending}
          onClick={() => save.mutate({ roleId: role.id, allow, deny })}
        >
          Save permissions
        </Button>
      </div>
    </div>
  );
}
