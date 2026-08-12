import { useRef, useState, type FormEvent } from 'react';
import { Trash2, Upload } from 'lucide-react';

import {
  AVATAR_MAX_BYTES,
  AVATAR_MIME_TYPES,
  BIO_MAX_LENGTH,
  DISPLAY_NAME_MAX_LENGTH,
  USERNAME_MAX_LENGTH,
  type CurrentUser,
} from '@nestcord/shared';

import { UserAvatar } from '@/components/UserAvatar';
import { useRemoveAvatar, useUpdateProfile, useUploadAvatar } from '@/features/users/use-users';
import { cn } from '@/lib/utils';
import { FormStatus, SettingsSection, TextField } from './SettingsPrimitives';

/** The palette offered in the picker. Any hex is accepted; these are the shortcuts. */
const ACCENTS = ['#e0234e', '#ff4d6d', '#f0b232', '#23a55a', '#4c8bf5', '#a855f7'] as const;

export function ProfileSection({ user }: { user: CurrentUser }) {
  return (
    <>
      <ProfileCardPreview user={user} />
      <AvatarSettings user={user} />
      <IdentitySettings user={user} />
    </>
  );
}

/**
 * What everyone else sees, shown above the fields that change it. Editing a
 * profile blind and hoping is the part this page exists to fix.
 */
function ProfileCardPreview({ user }: { user: CurrentUser }) {
  return (
    <SettingsSection title="Profile" description="This is how you appear to everyone else.">
      <div className="bg-surface-800 border-border overflow-hidden rounded-2xl border">
        <div
          className="h-20"
          style={{
            background: user.accentColor
              ? `linear-gradient(135deg, ${user.accentColor}, transparent 140%)`
              : 'linear-gradient(135deg, var(--color-surface-600), transparent 140%)',
          }}
        />
        <div className="px-5 pb-5">
          <div className="-mt-10 mb-3">
            <UserAvatar user={user} size="xl" status={user.status} />
          </div>
          <p className="font-display text-xl font-semibold">{user.displayName ?? user.username}</p>
          <p className="text-content-500 text-sm">@{user.username}</p>
          {user.bio && <p className="text-content-300 mt-3 text-sm">{user.bio}</p>}
        </div>
      </div>
    </SettingsSection>
  );
}

function AvatarSettings({ user }: { user: CurrentUser }) {
  const fileInput = useRef<HTMLInputElement>(null);
  const upload = useUploadAvatar();
  const remove = useRemoveAvatar();
  const [rejection, setRejection] = useState<string | null>(null);

  function onFileChosen(file: File | undefined): void {
    if (!file) return;

    // Checked here purely so the answer is instant; the server checks properly.
    if (file.size > AVATAR_MAX_BYTES) {
      setRejection(`That image is larger than ${AVATAR_MAX_BYTES / 1024 / 1024} MB.`);
      return;
    }

    setRejection(null);
    upload.mutate(file);
  }

  return (
    <SettingsSection title="Avatar" description="A PNG, JPEG, GIF or WEBP, up to 2 MB.">
      <div className="flex flex-wrap items-center gap-4">
        <UserAvatar user={user} size="xl" />

        <div className="flex flex-col gap-2">
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => fileInput.current?.click()}
              disabled={upload.isPending}
              className="bg-primary hover:bg-nest-600 inline-flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-medium transition-colors disabled:opacity-50"
            >
              <Upload className="size-4" aria-hidden />
              {upload.isPending ? 'Uploading…' : 'Upload image'}
            </button>

            {user.avatarUrl && (
              <button
                type="button"
                onClick={() => remove.mutate(undefined)}
                disabled={remove.isPending}
                className="border-border text-content-300 hover:text-destructive hover:border-destructive/50 inline-flex items-center gap-2 rounded-xl border px-4 py-2 text-sm transition-colors disabled:opacity-50"
              >
                <Trash2 className="size-4" aria-hidden />
                Remove
              </button>
            )}
          </div>

          <FormStatus
            isPending={upload.isPending || remove.isPending}
            error={rejection ? new Error(rejection) : (upload.error ?? remove.error)}
            isSuccess={upload.isSuccess || remove.isSuccess}
            successMessage="Avatar updated"
          />
        </div>

        <input
          ref={fileInput}
          type="file"
          accept={AVATAR_MIME_TYPES.join(',')}
          className="sr-only"
          onChange={(event) => {
            onFileChosen(event.target.files?.[0]);
            // Cleared so choosing the same file twice still fires a change event.
            event.target.value = '';
          }}
        />
      </div>
    </SettingsSection>
  );
}

function IdentitySettings({ user }: { user: CurrentUser }) {
  const update = useUpdateProfile();
  const [username, setUsername] = useState(user.username);
  const [displayName, setDisplayName] = useState(user.displayName ?? '');
  const [bio, setBio] = useState(user.bio ?? '');
  const [accentColor, setAccentColor] = useState(user.accentColor);

  const isDirty =
    username !== user.username ||
    displayName !== (user.displayName ?? '') ||
    bio !== (user.bio ?? '') ||
    accentColor !== user.accentColor;

  function onSubmit(event: FormEvent): void {
    event.preventDefault();

    // An emptied field is sent as null, which is how the API clears it.
    update.mutate({
      username,
      displayName: displayName.trim() || null,
      bio: bio.trim() || null,
      accentColor,
    });
  }

  return (
    <SettingsSection title="About you" description="Names and colours. Change as often as you like.">
      <form onSubmit={onSubmit} className="space-y-5">
        <TextField
          label="Username"
          value={username}
          onChange={setUsername}
          maxLength={USERNAME_MAX_LENGTH}
          hint="Letters, digits, dots and underscores. This is how people mention you."
        />

        <TextField
          label="Display name"
          value={displayName}
          onChange={setDisplayName}
          maxLength={DISPLAY_NAME_MAX_LENGTH}
          placeholder={user.username}
          hint="Shown instead of your username wherever there is room."
        />

        <TextField
          label="About me"
          value={bio}
          onChange={setBio}
          maxLength={BIO_MAX_LENGTH}
          multiline
          showCount
          placeholder="A line or two about you."
        />

        <fieldset>
          <legend className="text-content-300 mb-2 text-sm font-medium">Accent colour</legend>
          <div className="flex flex-wrap items-center gap-2">
            {ACCENTS.map((colour) => (
              <button
                key={colour}
                type="button"
                aria-label={`Accent ${colour}`}
                aria-pressed={accentColor === colour}
                onClick={() => setAccentColor(colour)}
                style={{ backgroundColor: colour }}
                className={cn(
                  'size-8 rounded-full transition-transform hover:scale-110',
                  accentColor === colour && 'ring-content-100 ring-2 ring-offset-2 ring-offset-transparent',
                )}
              />
            ))}

            <button
              type="button"
              onClick={() => setAccentColor(null)}
              aria-pressed={accentColor === null}
              className={cn(
                'border-border text-content-300 hover:text-content-100 rounded-full border px-3 py-1.5 text-xs transition-colors',
                accentColor === null && 'border-content-300 text-content-100',
              )}
            >
              None
            </button>
          </div>
        </fieldset>

        <div className="flex items-center gap-4">
          <button
            type="submit"
            disabled={!isDirty || update.isPending}
            className="bg-primary hover:bg-nest-600 rounded-xl px-5 py-2.5 text-sm font-medium transition-colors disabled:opacity-40"
          >
            Save changes
          </button>
          <FormStatus
            isPending={update.isPending}
            error={update.error}
            isSuccess={update.isSuccess && !isDirty}
            successMessage="Profile saved"
          />
        </div>
      </form>
    </SettingsSection>
  );
}
