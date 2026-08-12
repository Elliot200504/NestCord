import { useState } from 'react';

import {
  CHANNEL_NAME_MAX_LENGTH,
  CHANNEL_TOPIC_MAX_LENGTH,
  has,
  Permission,
  slugifyChannelName,
  type Channel,
  type ServerRole,
} from '@nestcord/shared';

import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog';
import { FormStatus, TextField } from '@/features/settings/SettingsPrimitives';
import { cn } from '@/lib/utils';
import { ChannelPermissionsEditor } from './ChannelPermissionsEditor';
import { useDeleteChannel, useUpdateChannel } from './use-channels';

type Tab = 'overview' | 'permissions';

/**
 * Everything about one channel: its name and topic, and which roles may do what in
 * it. Which tabs appear follows the permissions the API resolved *for this channel*
 * — a channel-level deny hides the tab it would have opened.
 */
export function ChannelSettingsDialog({
  serverId,
  channel,
  categories,
  roles,
  ownPermissions,
  open,
  onClose,
}: {
  serverId: string;
  channel: Channel;
  categories: Channel[];
  roles: ServerRole[];
  /** The caller's resolved permissions in this channel. */
  ownPermissions: number;
  open: boolean;
  onClose: () => void;
}) {
  const canManageChannel = has(ownPermissions, Permission.MANAGE_CHANNELS);
  const canManageRoles = has(ownPermissions, Permission.MANAGE_ROLES);
  const [tab, setTab] = useState<Tab>(canManageChannel ? 'overview' : 'permissions');

  return (
    <Dialog open={open} onOpenChange={(next) => !next && onClose()}>
      <DialogContent>
        <DialogTitle>{channel.type === 'CATEGORY' ? channel.name : `#${channel.name}`}</DialogTitle>
        <DialogDescription>
          {channel.type === 'CATEGORY'
            ? 'Rename this category or decide who can see it.'
            : 'Rename this channel, set its topic, or decide who can use it.'}
        </DialogDescription>

        {canManageChannel && canManageRoles && (
          <div className="border-border mt-4 flex gap-1 border-b">
            {(['overview', 'permissions'] as const).map((value) => (
              <button
                key={value}
                type="button"
                onClick={() => setTab(value)}
                aria-current={tab === value}
                className={cn(
                  'text-content-400 hover:text-content-100 -mb-px border-b-2 border-transparent px-3 py-2 text-sm capitalize transition-colors',
                  tab === value && 'border-primary text-content-100',
                )}
              >
                {value}
              </button>
            ))}
          </div>
        )}

        <div className="mt-5">
          {tab === 'overview' && canManageChannel ? (
            <OverviewTab
              serverId={serverId}
              channel={channel}
              categories={categories}
              onDeleted={onClose}
            />
          ) : (
            <ChannelPermissionsEditor
              serverId={serverId}
              channel={channel}
              roles={roles}
              ownPermissions={ownPermissions}
            />
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

function OverviewTab({
  serverId,
  channel,
  categories,
  onDeleted,
}: {
  serverId: string;
  channel: Channel;
  categories: Channel[];
  onDeleted: () => void;
}) {
  const [name, setName] = useState(channel.name);
  const [topic, setTopic] = useState(channel.topic ?? '');
  const [parentId, setParentId] = useState(channel.parentId ?? '');
  const update = useUpdateChannel(serverId);
  const remove = useDeleteChannel(serverId);

  const finalName = channel.type === 'CATEGORY' ? name.trim() : slugifyChannelName(name);
  const isDirty =
    finalName !== channel.name ||
    topic !== (channel.topic ?? '') ||
    parentId !== (channel.parentId ?? '');

  function handleSave() {
    update.mutate({
      channelId: channel.id,
      name,
      topic: topic.trim() === '' ? null : topic,
      // Categories have no parent of their own, so that field is simply not sent.
      ...(channel.type === 'CATEGORY' ? {} : { parentId: parentId === '' ? null : parentId }),
    });
  }

  return (
    <div className="space-y-4">
      <TextField
        label={channel.type === 'CATEGORY' ? 'Category name' : 'Channel name'}
        value={name}
        onChange={setName}
        maxLength={CHANNEL_NAME_MAX_LENGTH}
        hint={
          channel.type === 'CATEGORY' || finalName === channel.name
            ? undefined
            : `It will be saved as #${finalName || '…'}.`
        }
        disabled={update.isPending}
      />

      {channel.type !== 'CATEGORY' && (
        <>
          <TextField
            label="Topic"
            value={topic}
            onChange={setTopic}
            multiline
            maxLength={CHANNEL_TOPIC_MAX_LENGTH}
            showCount
            placeholder="What is this channel for?"
            disabled={update.isPending}
          />

          <div>
            <label htmlFor="channel-category" className="text-content-300 text-sm font-medium">
              Category
            </label>
            <select
              id="channel-category"
              value={parentId}
              onChange={(event) => setParentId(event.target.value)}
              disabled={update.isPending}
              className="border-input bg-surface-900/60 focus-visible:border-ring focus-visible:ring-ring/40 mt-1.5 w-full rounded-xl border px-3.5 py-2.5 text-sm transition-shadow outline-none focus-visible:ring-3 disabled:opacity-50"
            >
              <option value="">No category</option>
              {categories.map((category) => (
                <option key={category.id} value={category.id}>
                  {category.name}
                </option>
              ))}
            </select>
          </div>
        </>
      )}

      <div className="flex items-center justify-between gap-3">
        <FormStatus
          isPending={update.isPending || remove.isPending}
          error={update.error ?? remove.error}
          isSuccess={update.isSuccess && !isDirty}
        />

        <div className="flex gap-2">
          <Button
            type="button"
            variant="destructive"
            size="lg"
            disabled={remove.isPending}
            onClick={() => remove.mutate(channel.id, { onSuccess: onDeleted })}
          >
            Delete
          </Button>
          <Button
            type="button"
            size="lg"
            disabled={!isDirty || update.isPending}
            onClick={handleSave}
          >
            Save changes
          </Button>
        </div>
      </div>
    </div>
  );
}
