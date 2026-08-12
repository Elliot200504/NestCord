import { useState } from 'react';
import { Check, Copy, Trash2 } from 'lucide-react';

import type { Invite } from '@nestcord/shared';

import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog';
import { FormStatus } from '@/features/settings/SettingsPrimitives';
import { cn } from '@/lib/utils';
import { useUiStore } from '@/stores/ui-store';
import { useActiveServerId } from './useActiveServer';
import { useCreateInvite, useInvites, useRevokeInvite } from './use-servers';

/** The presets worth offering. Anything finer is a setting nobody asked for. */
const DURATIONS = [
  { label: '1 hour', hours: 1 },
  { label: '1 day', hours: 24 },
  { label: '7 days', hours: 24 * 7 },
  { label: 'Never', hours: undefined },
] as const;

export function InviteDialog() {
  const activeModal = useUiStore((state) => state.activeModal);
  const closeModal = useUiStore((state) => state.closeModal);
  const serverId = useActiveServerId();

  const isOpen = activeModal === 'invite' && serverId !== null;

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && closeModal()}>
      <DialogContent className="max-w-lg">
        <DialogTitle>Invite people</DialogTitle>
        <DialogDescription>
          Share a code and whoever has it can join. Revoke it any time.
        </DialogDescription>

        {serverId && <InviteBody serverId={serverId} />}
      </DialogContent>
    </Dialog>
  );
}

function InviteBody({ serverId }: { serverId: string }) {
  const [hours, setHours] = useState<number | undefined>(24 * 7);
  const { data: invites, isPending, isError } = useInvites(serverId);
  const create = useCreateInvite(serverId);

  return (
    <div className="mt-5 space-y-5">
      <div>
        <fieldset>
          <legend className="text-content-300 mb-2 text-sm font-medium">Expires after</legend>
          <div className="flex flex-wrap gap-2">
            {DURATIONS.map((duration) => (
              <button
                key={duration.label}
                type="button"
                aria-pressed={hours === duration.hours}
                onClick={() => setHours(duration.hours)}
                className={cn(
                  'border-border hover:border-content-500 rounded-lg border px-3 py-1.5 text-sm transition-colors',
                  hours === duration.hours && 'border-primary ring-primary/30 ring-2',
                )}
              >
                {duration.label}
              </button>
            ))}
          </div>
        </fieldset>

        <div className="mt-4 flex items-center justify-between gap-3">
          <FormStatus isPending={create.isPending} error={create.error} />
          <Button
            type="button"
            size="lg"
            disabled={create.isPending}
            onClick={() => create.mutate(hours === undefined ? {} : { expiresInHours: hours })}
          >
            Create a code
          </Button>
        </div>
      </div>

      <section>
        <h3 className="text-content-300 mb-2 text-sm font-medium">Active codes</h3>

        {isPending && <p className="text-content-500 text-sm">Loading…</p>}

        {isError && (
          <p role="alert" className="text-destructive text-sm">
            Could not load the invites for this server.
          </p>
        )}

        {invites?.length === 0 && (
          <p className="text-content-500 text-sm">No codes yet — create one above.</p>
        )}

        <ul className="space-y-1.5">
          {invites?.map((invite) => (
            <li key={invite.code}>
              <InviteRow serverId={serverId} invite={invite} />
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}

function InviteRow({ serverId, invite }: { serverId: string; invite: Invite }) {
  const [copied, setCopied] = useState(false);
  const revoke = useRevokeInvite(serverId);

  async function copy() {
    await navigator.clipboard.writeText(invite.code);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className="bg-surface-900/60 flex items-center gap-3 rounded-xl px-3 py-2">
      <code className="flex-1 font-mono text-sm tracking-wider">{invite.code}</code>

      <span className="text-content-500 text-xs">{describe(invite)}</span>

      <Button
        type="button"
        variant="ghost"
        size="icon"
        aria-label={`Copy code ${invite.code}`}
        onClick={() => void copy()}
      >
        {copied ? (
          <Check className="text-online size-4" aria-hidden />
        ) : (
          <Copy className="size-4" aria-hidden />
        )}
      </Button>

      <Button
        type="button"
        variant="ghost"
        size="icon"
        aria-label={`Revoke code ${invite.code}`}
        disabled={revoke.isPending}
        onClick={() => revoke.mutate(invite.code)}
      >
        <Trash2 className="text-destructive size-4" aria-hidden />
      </Button>
    </div>
  );
}

function describe(invite: Invite): string {
  const uses = invite.maxUses === null ? `${invite.uses} uses` : `${invite.uses}/${invite.maxUses}`;
  const expiry =
    invite.expiresAt === null
      ? 'never expires'
      : `expires ${new Date(invite.expiresAt).toLocaleDateString()}`;

  return `${uses} · ${expiry}`;
}
