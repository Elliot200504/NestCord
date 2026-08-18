import { useState, type FormEvent } from 'react';
import { useNavigate } from '@tanstack/react-router';

import {
  CHANNEL_NAME_MAX_LENGTH,
  slugifyChannelName,
  type Channel,
  type ChannelType,
} from '@nestcord/shared';

import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog';
import { FormStatus, TextField } from '@/features/settings/SettingsPrimitives';
import { cn } from '@/lib/utils';
import { useCreateChannel } from './use-channels';

type CreatableType = Extract<ChannelType, 'TEXT' | 'VOICE' | 'CATEGORY'>;

const TYPE_OPTIONS: { value: CreatableType; label: string; hint: string }[] = [
  { value: 'TEXT', label: 'Text', hint: 'Send messages, images and links.' },
  { value: 'VOICE', label: 'Voice', hint: 'Talk together, up to eight at a time.' },
  { value: 'CATEGORY', label: 'Category', hint: 'A heading to group channels under.' },
];

/**
 * Create a channel or a category.
 *
 * `parentId` comes from wherever the dialog was opened — the plus on a category
 * header creates inside it, the one in the sidebar header creates at the top level.
 */
export function CreateChannelDialog({
  serverId,
  parentId,
  open,
  onClose,
}: {
  serverId: string;
  parentId: string | null;
  open: boolean;
  onClose: () => void;
}) {
  return (
    <Dialog open={open} onOpenChange={(next) => !next && onClose()}>
      <DialogContent>
        <CreateChannelForm serverId={serverId} parentId={parentId} onClose={onClose} />
      </DialogContent>
    </Dialog>
  );
}

function CreateChannelForm({
  serverId,
  parentId,
  onClose,
}: {
  serverId: string;
  parentId: string | null;
  onClose: () => void;
}) {
  const [type, setType] = useState<CreatableType>('TEXT');
  const [name, setName] = useState('');
  const create = useCreateChannel(serverId);
  const navigate = useNavigate();

  // Text and voice channels are addressed as #like-this, so the name is shown the
  // way it will be saved rather than being silently rewritten afterwards.
  const finalName = type === 'CATEGORY' ? name.trim() : slugifyChannelName(name);
  const isValid = finalName.length > 0;

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (!isValid) return;

    const channel: Channel = await create.mutateAsync({
      name,
      type,
      // A category is a heading, so it never goes inside another one.
      parentId: type === 'CATEGORY' ? null : parentId,
    });

    onClose();

    if (channel.type === 'TEXT') {
      await navigate({
        to: '/app/$serverId/$channelId',
        params: { serverId, channelId: channel.id },
      });
    }
  }

  return (
    <>
      <DialogTitle>Create a channel</DialogTitle>
      <DialogDescription>
        {type === 'CATEGORY'
          ? 'Categories group channels together in the sidebar.'
          : 'Channels are where conversations happen.'}
      </DialogDescription>

      <form onSubmit={handleSubmit} className="mt-5 space-y-4">
        <fieldset>
          <legend className="text-content-300 mb-2 text-sm font-medium">Channel type</legend>
          <div className="grid gap-2 sm:grid-cols-3">
            {TYPE_OPTIONS.map((option) => (
              <button
                key={option.value}
                type="button"
                aria-pressed={type === option.value}
                onClick={() => setType(option.value)}
                className={cn(
                  'border-border hover:border-content-500 rounded-xl border p-3 text-left transition-colors',
                  type === option.value && 'border-primary ring-primary/30 ring-3',
                )}
              >
                <span className="block text-sm font-medium">{option.label}</span>
                <span className="text-content-500 mt-0.5 block text-xs">{option.hint}</span>
              </button>
            ))}
          </div>
        </fieldset>

        <TextField
          label={type === 'CATEGORY' ? 'Category name' : 'Channel name'}
          value={name}
          onChange={setName}
          placeholder={type === 'CATEGORY' ? 'Text Channels' : 'new-channel'}
          maxLength={CHANNEL_NAME_MAX_LENGTH}
          showCount
          hint={
            type === 'CATEGORY'
              ? undefined
              : `It will be saved as ${finalName ? `#${finalName}` : 'nothing yet'}.`
          }
          disabled={create.isPending}
        />

        <div className="flex items-center justify-between gap-3">
          <FormStatus isPending={create.isPending} error={create.error} />
          <Button type="submit" size="lg" disabled={!isValid || create.isPending}>
            Create channel
          </Button>
        </div>
      </form>
    </>
  );
}
