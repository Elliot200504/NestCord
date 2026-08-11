import { useState, type FormEvent } from 'react';
import { Monitor, Smartphone } from 'lucide-react';

import { PASSWORD_MIN_LENGTH, type CurrentUser } from '@nestcord/shared';

import {
  useChangePassword,
  useRevokeOtherSessions,
  useRevokeSession,
  useSessions,
} from '@/features/users/use-users';
import { FormStatus, SettingsSection, TextField } from './SettingsPrimitives';

export function AccountSection({ user }: { user: CurrentUser }) {
  return (
    <>
      <AccountDetails user={user} />
      <PasswordSettings />
      <SessionSettings />
    </>
  );
}

function AccountDetails({ user }: { user: CurrentUser }) {
  return (
    <SettingsSection title="My account" description="The details behind your login.">
      <dl className="bg-surface-800 border-border divide-border divide-y rounded-2xl border">
        {[
          { label: 'Username', value: user.username },
          { label: 'Email', value: user.email },
          { label: 'Member since', value: new Date(user.createdAt).toLocaleDateString() },
        ].map((row) => (
          <div key={row.label} className="flex items-baseline justify-between gap-4 px-5 py-3.5">
            <dt className="text-content-500 text-sm">{row.label}</dt>
            <dd className="truncate text-sm font-medium">{row.value}</dd>
          </div>
        ))}
      </dl>
      <p className="text-content-500 mt-2 text-xs">
        Your email is never shown to anyone else. Change your username under Profile.
      </p>
    </SettingsSection>
  );
}

function PasswordSettings() {
  const change = useChangePassword();
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [mismatch, setMismatch] = useState(false);

  const canSubmit =
    currentPassword.length > 0 && newPassword.length >= PASSWORD_MIN_LENGTH && !change.isPending;

  function onSubmit(event: FormEvent): void {
    event.preventDefault();

    if (newPassword !== confirmation) {
      setMismatch(true);
      return;
    }

    setMismatch(false);
    change.mutate(
      { currentPassword, newPassword },
      {
        onSuccess: () => {
          setCurrentPassword('');
          setNewPassword('');
          setConfirmation('');
        },
      },
    );
  }

  return (
    <SettingsSection
      title="Password"
      description="Changing your password signs out every other device."
    >
      <form onSubmit={onSubmit} className="max-w-sm space-y-4">
        <TextField
          label="Current password"
          type="password"
          value={currentPassword}
          onChange={setCurrentPassword}
          autoComplete="current-password"
        />
        <TextField
          label="New password"
          type="password"
          value={newPassword}
          onChange={setNewPassword}
          autoComplete="new-password"
          hint={`At least ${PASSWORD_MIN_LENGTH} characters.`}
        />
        <TextField
          label="Confirm new password"
          type="password"
          value={confirmation}
          onChange={setConfirmation}
          autoComplete="new-password"
        />

        <div className="flex items-center gap-4">
          <button
            type="submit"
            disabled={!canSubmit}
            className="bg-primary hover:bg-nest-600 rounded-xl px-5 py-2.5 text-sm font-medium transition-colors disabled:opacity-40"
          >
            Change password
          </button>
          <FormStatus
            isPending={change.isPending}
            error={mismatch ? new Error('The two new passwords do not match') : change.error}
            isSuccess={change.isSuccess}
            successMessage="Password changed"
          />
        </div>
      </form>
    </SettingsSection>
  );
}

function SessionSettings() {
  const { data: sessions, isPending, error } = useSessions();
  const revoke = useRevokeSession();
  const revokeOthers = useRevokeOtherSessions();

  const others = sessions?.filter((session) => !session.current) ?? [];

  return (
    <SettingsSection
      title="Devices"
      description="Everywhere you are signed in. Sign out anything you do not recognise."
    >
      {isPending && <p className="text-content-500 text-sm">Loading your devices…</p>}
      {error && (
        <p role="alert" className="text-destructive text-sm">
          {error.message}
        </p>
      )}

      <ul className="space-y-2">
        {sessions?.map((session) => (
          <li
            key={session.id}
            className="bg-surface-800 border-border flex items-center gap-3 rounded-xl border px-4 py-3"
          >
            <DeviceIcon userAgent={session.userAgent} />

            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium">{describeDevice(session.userAgent)}</p>
              <p className="text-content-500 text-xs">
                Signed in {new Date(session.createdAt).toLocaleString()}
              </p>
            </div>

            {session.current ? (
              <span className="bg-online/15 text-online rounded-full px-2.5 py-1 text-xs font-medium">
                This device
              </span>
            ) : (
              <button
                type="button"
                onClick={() => revoke.mutate(session.id)}
                disabled={revoke.isPending}
                className="text-content-300 hover:text-destructive text-xs transition-colors disabled:opacity-50"
              >
                Sign out
              </button>
            )}
          </li>
        ))}
      </ul>

      {others.length > 0 && (
        <div className="mt-4 flex items-center gap-4">
          <button
            type="button"
            onClick={() => revokeOthers.mutate(undefined)}
            disabled={revokeOthers.isPending}
            className="border-destructive/40 text-destructive hover:bg-destructive/10 rounded-xl border px-4 py-2 text-sm transition-colors disabled:opacity-50"
          >
            Sign out all other devices ({others.length})
          </button>
          <FormStatus isPending={revokeOthers.isPending} error={revokeOthers.error} />
        </div>
      )}
    </SettingsSection>
  );
}

function DeviceIcon({ userAgent }: { userAgent: string | null }) {
  const Icon = isMobile(userAgent) ? Smartphone : Monitor;

  return <Icon className="text-content-500 size-5 shrink-0" aria-hidden />;
}

function isMobile(userAgent: string | null): boolean {
  return /android|iphone|ipad|mobile/i.test(userAgent ?? '');
}

/**
 * A user agent string is unreadable; the browser name is the part that actually
 * helps someone recognise their own device.
 */
function describeDevice(userAgent: string | null): string {
  if (!userAgent) return 'Unknown device';

  const browser =
    ['Firefox', 'Edg', 'Chrome', 'Safari'].find((name) => userAgent.includes(name)) ?? null;
  const platform =
    ['Windows', 'Macintosh', 'Linux', 'Android', 'iPhone', 'iPad'].find((name) =>
      userAgent.includes(name),
    ) ?? null;

  if (!browser && !platform) return userAgent.slice(0, 40);

  return [browser === 'Edg' ? 'Edge' : browser, platform].filter(Boolean).join(' on ');
}
