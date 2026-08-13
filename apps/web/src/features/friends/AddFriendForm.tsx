import { useState, type FormEvent } from 'react';

import { USERNAME_MAX_LENGTH } from '@nestcord/shared';

import { Button } from '@/components/ui/button';
import { FormStatus, TextField } from '@/features/settings/SettingsPrimitives';
import { useSendFriendRequest } from './use-friends';

/**
 * Add someone by username (PLAN.MD §18).
 *
 * The server answers with the friendship it created — or with why it would not — so
 * the error the API gives is the error shown, rather than being guessed at here.
 */
export function AddFriendForm() {
  const [username, setUsername] = useState('');
  const send = useSendFriendRequest();

  const trimmed = username.trim();

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (trimmed.length === 0) return;

    // `mutate` rather than `mutateAsync`: a refused request is reported by
    // `send.error` below, and awaiting it here would only be an unhandled rejection.
    send.mutate(trimmed, { onSuccess: () => setUsername('') });
  }

  return (
    <form onSubmit={handleSubmit} className="max-w-md space-y-3">
      <TextField
        label="Add a friend"
        value={username}
        onChange={setUsername}
        placeholder="username"
        maxLength={USERNAME_MAX_LENGTH}
        hint="You can add someone with their exact username."
      />

      <div className="flex items-center gap-3">
        <Button type="submit" disabled={trimmed.length === 0 || send.isPending}>
          Send request
        </Button>

        <FormStatus
          isPending={send.isPending}
          // A failed send is not a form the user should have to clear by hand, so the
          // error stays until the next attempt replaces it.
          error={send.error}
          isSuccess={send.isSuccess}
          successMessage="Request sent"
        />
      </div>
    </form>
  );
}
