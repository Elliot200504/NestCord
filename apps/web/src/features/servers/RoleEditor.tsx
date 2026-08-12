import { useState } from 'react';
import { Plus, Trash2 } from 'lucide-react';

import {
  has,
  Permission,
  PERMISSION_NAMES,
  ROLE_NAME_MAX_LENGTH,
  type ServerRole,
} from '@nestcord/shared';

import { Button } from '@/components/ui/button';
import { ColorPicker, FormStatus, TextField } from '@/features/settings/SettingsPrimitives';
import { PERMISSION_LABELS } from '@/lib/permission-labels';
import { cn } from '@/lib/utils';
import { useCreateRole, useDeleteRole, useRoles, useUpdateRole } from './use-servers';

/** The same palette the profile accent uses, so the app stays one palette. */
const ROLE_COLORS = ['#e0234e', '#ff4d6d', '#f0b232', '#23a55a', '#4c8bf5', '#a855f7'] as const;

/**
 * Roles, their colour and their permissions.
 *
 * `ownPermissions` decides what this editor offers: a flag you do not hold is shown
 * disabled, because the API will refuse to grant it. That is a courtesy to the user,
 * not the check — the server re-decides every time.
 */
export function RoleEditor({
  serverId,
  ownPermissions,
}: {
  serverId: string;
  ownPermissions: number;
}) {
  const { data: roles, isPending, isError } = useRoles(serverId);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const create = useCreateRole(serverId);

  const selected = roles?.find((role) => role.id === selectedId) ?? roles?.[0] ?? null;

  if (isPending) return <p className="text-content-500 text-sm">Loading roles…</p>;

  if (isError) {
    return (
      <p role="alert" className="text-destructive text-sm">
        Could not load the roles for this server.
      </p>
    );
  }

  return (
    <div className="grid gap-5 sm:grid-cols-[10rem_1fr]">
      <div>
        <ul className="space-y-1">
          {roles?.map((role) => (
            <li key={role.id}>
              <button
                type="button"
                onClick={() => setSelectedId(role.id)}
                aria-current={selected?.id === role.id}
                className={cn(
                  'hover:bg-surface-700 flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-left text-sm transition-colors',
                  selected?.id === role.id && 'bg-surface-600',
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

        <div className="mt-2">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            disabled={create.isPending}
            onClick={() => create.mutate({ name: 'New role' })}
          >
            <Plus className="size-3.5" aria-hidden />
            New role
          </Button>
        </div>
        <FormStatus error={create.error} />
      </div>

      {selected && (
        <RoleForm
          key={selected.id}
          serverId={serverId}
          role={selected}
          ownPermissions={ownPermissions}
        />
      )}
    </div>
  );
}

function RoleForm({
  serverId,
  role,
  ownPermissions,
}: {
  serverId: string;
  role: ServerRole;
  ownPermissions: number;
}) {
  const [name, setName] = useState(role.name);
  const [color, setColor] = useState(role.color);
  const [permissions, setPermissions] = useState(role.permissions);
  const update = useUpdateRole(serverId);
  const remove = useDeleteRole(serverId);

  const isDirty = name !== role.name || color !== role.color || permissions !== role.permissions;

  function toggle(flag: number) {
    setPermissions((current) => (current & flag ? current & ~flag : current | flag));
  }

  return (
    <div className="space-y-4">
      <TextField
        label="Role name"
        value={name}
        onChange={setName}
        maxLength={ROLE_NAME_MAX_LENGTH}
        // @everyone is the one role whose name is structural rather than chosen.
        disabled={role.isDefault || update.isPending}
      />

      <ColorPicker
        label="Role colour"
        value={color}
        colors={ROLE_COLORS}
        onChange={setColor}
      />

      <fieldset>
        <legend className="text-content-300 mb-2 text-sm font-medium">Permissions</legend>
        <ul className="space-y-1">
          {PERMISSION_NAMES.map((flagName) => {
            const flag = Permission[flagName];
            const canGrant = has(ownPermissions, flag);

            return (
              <li key={flagName}>
                <label
                  className={cn(
                    'flex items-center gap-2.5 rounded-lg px-2 py-1.5 text-sm',
                    canGrant ? 'hover:bg-surface-700' : 'opacity-45',
                  )}
                >
                  <input
                    type="checkbox"
                    checked={(permissions & flag) !== 0}
                    disabled={!canGrant || update.isPending}
                    onChange={() => toggle(flag)}
                    className="accent-primary size-4"
                  />
                  <span className="flex-1">{PERMISSION_LABELS[flagName]}</span>
                  {!canGrant && (
                    <span className="text-content-500 text-xs">You do not have this</span>
                  )}
                </label>
              </li>
            );
          })}
        </ul>
      </fieldset>

      <div className="flex items-center justify-between gap-3">
        <FormStatus
          isPending={update.isPending || remove.isPending}
          error={update.error ?? remove.error}
          isSuccess={update.isSuccess && !isDirty}
        />

        <div className="flex gap-2">
          {!role.isDefault && (
            <Button
              type="button"
              variant="destructive"
              size="lg"
              disabled={remove.isPending}
              onClick={() => remove.mutate(role.id)}
            >
              <Trash2 className="size-4" aria-hidden />
              Delete
            </Button>
          )}

          <Button
            type="button"
            size="lg"
            disabled={!isDirty || update.isPending}
            onClick={() => update.mutate({ roleId: role.id, name, color, permissions })}
          >
            Save role
          </Button>
        </div>
      </div>
    </div>
  );
}
