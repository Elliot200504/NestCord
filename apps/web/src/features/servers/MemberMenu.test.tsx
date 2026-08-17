import type { ReactNode } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';

import {
  DEFAULT_EVERYONE_PERMISSIONS,
  Permission,
  type PublicUser,
  type Server,
  type ServerMember,
  type ServerRole,
} from '@nestcord/shared';

import { MemberMenu } from './MemberMenu';

const OWNER = 'user-owner';
const MODERATOR = 'user-mod';
const TROUBLEMAKER = 'user-troublemaker';

const EVERYONE: ServerRole = {
  id: 'role-everyone',
  name: '@everyone',
  color: null,
  permissions: DEFAULT_EVERYONE_PERMISSIONS,
  position: 0,
  isDefault: true,
};

const MOD_ROLE: ServerRole = {
  id: 'role-mod',
  name: 'Moderator',
  color: null,
  permissions: DEFAULT_EVERYONE_PERMISSIONS | Permission.KICK_MEMBERS | Permission.BAN_MEMBERS,
  position: 5,
  isDefault: false,
};

function user(id: string): PublicUser {
  return {
    id,
    username: id,
    displayName: null,
    avatarUrl: null,
    accentColor: null,
    status: 'ONLINE',
  };
}

function member(id: string, roleIds: string[] = [EVERYONE.id]): ServerMember {
  return { user: user(id), nickname: null, joinedAt: '2026-01-01T00:00:00.000Z', roleIds };
}

function server(permissions: number): Server {
  return {
    id: 'server-1',
    name: 'NestCord HQ',
    iconUrl: null,
    ownerId: OWNER,
    createdAt: '2026-01-01T00:00:00.000Z',
    memberCount: 3,
    roles: [EVERYONE, MOD_ROLE],
    permissions,
  };
}

function wrapper({ children }: { children: ReactNode }) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });

  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
}

function drawRow(options: {
  target: ServerMember;
  viewer: ServerMember | undefined;
  permissions: number;
}) {
  return render(
    <MemberMenu
      member={options.target}
      server={server(options.permissions)}
      viewer={options.viewer}
    >
      <button type="button">{options.target.user.username}</button>
    </MemberMenu>,
    { wrapper },
  );
}

async function rightClick(name: string) {
  await userEvent.pointer({ keys: '[MouseRight]', target: screen.getByRole('button', { name }) });
}

const MODERATOR_PERMISSIONS =
  DEFAULT_EVERYONE_PERMISSIONS | Permission.KICK_MEMBERS | Permission.BAN_MEMBERS;

describe('MemberMenu', () => {
  it('offers kick and ban to a moderator who outranks the member', async () => {
    drawRow({
      target: member(TROUBLEMAKER),
      viewer: member(MODERATOR, [EVERYONE.id, MOD_ROLE.id]),
      permissions: MODERATOR_PERMISSIONS,
    });

    await rightClick(TROUBLEMAKER);

    expect(await screen.findByRole('menuitem', { name: /kick/i })).toBeInTheDocument();
    expect(screen.getByRole('menuitem', { name: /ban/i })).toBeInTheDocument();
  });

  it('offers kick alone when the moderator cannot ban', async () => {
    drawRow({
      target: member(TROUBLEMAKER),
      viewer: member(MODERATOR, [EVERYONE.id, MOD_ROLE.id]),
      permissions: DEFAULT_EVERYONE_PERMISSIONS | Permission.KICK_MEMBERS,
    });

    await rightClick(TROUBLEMAKER);

    expect(await screen.findByRole('menuitem', { name: /kick/i })).toBeInTheDocument();
    expect(screen.queryByRole('menuitem', { name: /ban/i })).toBeNull();
  });

  it('offers nothing to a plain member', async () => {
    drawRow({
      target: member(TROUBLEMAKER),
      viewer: member(MODERATOR),
      permissions: DEFAULT_EVERYONE_PERMISSIONS,
    });

    await rightClick(TROUBLEMAKER);

    expect(screen.queryByRole('menu')).toBeNull();
  });

  it('offers nothing against the owner, even to a moderator', async () => {
    drawRow({
      target: member(OWNER, [EVERYONE.id]),
      viewer: member(MODERATOR, [EVERYONE.id, MOD_ROLE.id]),
      permissions: MODERATOR_PERMISSIONS,
    });

    await rightClick(OWNER);

    expect(screen.queryByRole('menu')).toBeNull();
  });

  it('offers nothing against yourself', async () => {
    const viewer = member(MODERATOR, [EVERYONE.id, MOD_ROLE.id]);

    drawRow({ target: viewer, viewer, permissions: MODERATOR_PERMISSIONS });

    await rightClick(MODERATOR);

    expect(screen.queryByRole('menu')).toBeNull();
  });

  it('offers nothing against a member of the same rank', async () => {
    drawRow({
      target: member(TROUBLEMAKER, [EVERYONE.id, MOD_ROLE.id]),
      viewer: member(MODERATOR, [EVERYONE.id, MOD_ROLE.id]),
      permissions: MODERATOR_PERMISSIONS,
    });

    await rightClick(TROUBLEMAKER);

    expect(screen.queryByRole('menu')).toBeNull();
  });

  it('lets the owner act on a moderator who outranks everyone else', async () => {
    drawRow({
      target: member(MODERATOR, [EVERYONE.id, MOD_ROLE.id]),
      viewer: member(OWNER),
      permissions: MODERATOR_PERMISSIONS,
    });

    await rightClick(MODERATOR);

    expect(await screen.findByRole('menuitem', { name: /ban/i })).toBeInTheDocument();
  });

  it('asks for a reason before it bans', async () => {
    drawRow({
      target: member(TROUBLEMAKER),
      viewer: member(MODERATOR, [EVERYONE.id, MOD_ROLE.id]),
      permissions: MODERATOR_PERMISSIONS,
    });

    await rightClick(TROUBLEMAKER);
    await userEvent.click(await screen.findByRole('menuitem', { name: /ban/i }));

    expect(await screen.findByRole('dialog')).toBeInTheDocument();
    expect(screen.getByLabelText('Reason')).toHaveValue('');
  });
});
