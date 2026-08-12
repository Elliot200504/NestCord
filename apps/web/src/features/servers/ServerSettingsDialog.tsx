import { useRef, useState, type FormEvent } from 'react';
import { Trash2, Upload } from 'lucide-react';

import {
  has,
  IMAGE_MIME_TYPES,
  Permission,
  SERVER_ICON_MAX_BYTES,
  SERVER_NAME_MAX_LENGTH,
  SERVER_NAME_MIN_LENGTH,
  type Server,
} from '@nestcord/shared';

import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog';
import { FormStatus, TextField } from '@/features/settings/SettingsPrimitives';
import { cn } from '@/lib/utils';
import { useUiStore } from '@/stores/ui-store';
import { RoleEditor } from './RoleEditor';
import { useActiveServerId } from './useActiveServer';
import {
  serverInitials,
  useRemoveServerIcon,
  useRenameServer,
  useServer,
  useUploadServerIcon,
} from './use-servers';

type Tab = 'overview' | 'roles';

export function ServerSettingsDialog() {
  const activeModal = useUiStore((state) => state.activeModal);
  const closeModal = useUiStore((state) => state.closeModal);
  const serverId = useActiveServerId();
  const { data: server } = useServer(serverId);

  const isOpen = activeModal === 'server-settings' && server !== undefined;

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && closeModal()}>
      <DialogContent className="max-w-2xl">
        <DialogTitle>Server settings</DialogTitle>
        <DialogDescription>{server?.name}</DialogDescription>

        {server && <SettingsBody server={server} />}
      </DialogContent>
    </Dialog>
  );
}

function SettingsBody({ server }: { server: Server }) {
  const [tab, setTab] = useState<Tab>('overview');

  const canManageServer = has(server.permissions, Permission.MANAGE_SERVER);
  const canManageRoles = has(server.permissions, Permission.MANAGE_ROLES);

  const tabs: ReadonlyArray<{ id: Tab; label: string; enabled: boolean }> = [
    { id: 'overview', label: 'Overview', enabled: canManageServer },
    { id: 'roles', label: 'Roles', enabled: canManageRoles },
  ];

  const available = tabs.filter((entry) => entry.enabled);

  if (available.length === 0) {
    return (
      <p className="text-content-400 mt-5 text-sm">
        You do not have permission to change anything in this server.
      </p>
    );
  }

  // If the default tab is not available to this member, start on one that is.
  const activeTab = available.some((entry) => entry.id === tab) ? tab : available[0]!.id;

  return (
    <div className="mt-5">
      <div
        role="tablist"
        aria-label="Server settings"
        className="border-border flex gap-1 border-b"
      >
        {available.map((entry) => (
          <button
            key={entry.id}
            type="button"
            role="tab"
            aria-selected={activeTab === entry.id}
            onClick={() => setTab(entry.id)}
            className={cn(
              'text-content-400 hover:text-content-100 -mb-px border-b-2 border-transparent px-3 py-2 text-sm transition-colors',
              activeTab === entry.id && 'border-primary text-content-100',
            )}
          >
            {entry.label}
          </button>
        ))}
      </div>

      <div className="pt-5">
        {activeTab === 'overview' && <OverviewTab server={server} />}
        {activeTab === 'roles' && (
          <RoleEditor serverId={server.id} ownPermissions={server.permissions} />
        )}
      </div>
    </div>
  );
}

function OverviewTab({ server }: { server: Server }) {
  const [name, setName] = useState(server.name);
  const [rejection, setRejection] = useState<string | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);

  const rename = useRenameServer(server.id);
  const uploadIcon = useUploadServerIcon(server.id);
  const removeIcon = useRemoveServerIcon(server.id);

  const isDirty = name.trim() !== server.name;
  const isValid = name.trim().length >= SERVER_NAME_MIN_LENGTH;

  function handleFile(file: File | undefined) {
    setRejection(null);
    if (!file) return;

    // Checked here so an obvious mistake is answered instantly; the API checks the
    // real bytes, which is the check that counts.
    if (file.size > SERVER_ICON_MAX_BYTES) {
      setRejection(`That image is larger than ${SERVER_ICON_MAX_BYTES / 1024 / 1024} MB.`);
      return;
    }

    uploadIcon.mutate(file);
  }

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (isDirty && isValid) rename.mutate(name.trim());
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        {server.iconUrl ? (
          <img src={server.iconUrl} alt="" className="size-16 rounded-2xl object-cover" />
        ) : (
          <span
            aria-hidden
            className="bg-surface-700 grid size-16 place-items-center rounded-2xl text-lg font-semibold"
          >
            {serverInitials(server)}
          </span>
        )}

        <div className="space-y-2">
          <div className="flex gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={uploadIcon.isPending}
              onClick={() => fileInput.current?.click()}
            >
              <Upload className="size-3.5" aria-hidden />
              Upload icon
            </Button>

            {server.iconUrl && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                disabled={removeIcon.isPending}
                onClick={() => removeIcon.mutate(undefined)}
              >
                <Trash2 className="size-3.5" aria-hidden />
                Remove
              </Button>
            )}
          </div>

          <input
            ref={fileInput}
            type="file"
            accept={IMAGE_MIME_TYPES.join(',')}
            className="hidden"
            onChange={(event) => handleFile(event.target.files?.[0])}
          />

          <FormStatus
            isPending={uploadIcon.isPending || removeIcon.isPending}
            error={rejection ? new Error(rejection) : (uploadIcon.error ?? removeIcon.error)}
          />
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <TextField
          label="Server name"
          value={name}
          onChange={setName}
          maxLength={SERVER_NAME_MAX_LENGTH}
          showCount
          disabled={rename.isPending}
        />

        <div className="flex items-center justify-between gap-3">
          <FormStatus
            isPending={rename.isPending}
            error={rename.error}
            isSuccess={rename.isSuccess && !isDirty}
          />
          <Button type="submit" size="lg" disabled={!isDirty || !isValid || rename.isPending}>
            Save name
          </Button>
        </div>
      </form>
    </div>
  );
}
