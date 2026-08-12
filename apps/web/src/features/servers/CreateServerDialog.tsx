import { useState, type FormEvent } from 'react';
import { useNavigate } from '@tanstack/react-router';

import {
  DEFAULT_CHANNEL_NAME,
  INVITE_CODE_LENGTH,
  INVITE_CODE_PATTERN,
  SERVER_NAME_MAX_LENGTH,
  SERVER_NAME_MIN_LENGTH,
} from '@nestcord/shared';

import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog';
import { FormStatus, TextField } from '@/features/settings/SettingsPrimitives';
import { useUiStore } from '@/stores/ui-store';
import { useCreateServer, useJoinServer } from './use-servers';

type Mode = 'create' | 'join';

/**
 * One dialog for both ways into a server, because they are the same decision from
 * the user's side: start something, or go where you were invited.
 */
export function CreateServerDialog() {
  const activeModal = useUiStore((state) => state.activeModal);
  const closeModal = useUiStore((state) => state.closeModal);

  return (
    <Dialog open={activeModal === 'create-server'} onOpenChange={(open) => !open && closeModal()}>
      <DialogContent>
        <ServerDialogBody onDone={closeModal} />
      </DialogContent>
    </Dialog>
  );
}

function ServerDialogBody({ onDone }: { onDone: () => void }) {
  const [mode, setMode] = useState<Mode>('create');

  return (
    <>
      <DialogTitle>{mode === 'create' ? 'Create a server' : 'Join a server'}</DialogTitle>
      <DialogDescription>
        {mode === 'create'
          ? `Give it a name. You can rename it later, and it starts with a #${DEFAULT_CHANNEL_NAME} channel.`
          : 'Paste the invite code someone shared with you.'}
      </DialogDescription>

      <div className="mt-5">
        {mode === 'create' ? <CreateForm onDone={onDone} /> : <JoinForm onDone={onDone} />}
      </div>

      <button
        type="button"
        onClick={() => setMode(mode === 'create' ? 'join' : 'create')}
        className="text-content-400 hover:text-content-100 mt-4 text-sm underline-offset-4 transition-colors hover:underline"
      >
        {mode === 'create' ? 'I have an invite code instead' : 'Create my own server instead'}
      </button>
    </>
  );
}

function CreateForm({ onDone }: { onDone: () => void }) {
  const [name, setName] = useState('');
  const create = useCreateServer();
  const navigate = useNavigate();
  const isValid = name.trim().length >= SERVER_NAME_MIN_LENGTH;

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (!isValid) return;

    const server = await create.mutateAsync(name.trim());

    onDone();
    await navigate({
      to: '/app/$serverId/$channelId',
      params: { serverId: server.id, channelId: DEFAULT_CHANNEL_NAME },
    });
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <TextField
        label="Server name"
        value={name}
        onChange={setName}
        placeholder="Book Club"
        maxLength={SERVER_NAME_MAX_LENGTH}
        showCount
        disabled={create.isPending}
      />

      <div className="flex items-center justify-between gap-3">
        <FormStatus isPending={create.isPending} error={create.error} />
        <Button type="submit" size="lg" disabled={!isValid || create.isPending}>
          Create server
        </Button>
      </div>
    </form>
  );
}

function JoinForm({ onDone }: { onDone: () => void }) {
  const [code, setCode] = useState('');
  const join = useJoinServer();
  const navigate = useNavigate();
  const isValid = INVITE_CODE_PATTERN.test(code.trim());

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (!isValid) return;

    const server = await join.mutateAsync(code.trim());

    onDone();
    await navigate({
      to: '/app/$serverId/$channelId',
      params: { serverId: server.id, channelId: DEFAULT_CHANNEL_NAME },
    });
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <TextField
        label="Invite code"
        value={code}
        onChange={setCode}
        placeholder="Kp3rTx9a"
        maxLength={INVITE_CODE_LENGTH}
        hint={`${INVITE_CODE_LENGTH} letters and numbers.`}
        disabled={join.isPending}
      />

      <div className="flex items-center justify-between gap-3">
        <FormStatus isPending={join.isPending} error={join.error} />
        <Button type="submit" size="lg" disabled={!isValid || join.isPending}>
          Join server
        </Button>
      </div>
    </form>
  );
}
