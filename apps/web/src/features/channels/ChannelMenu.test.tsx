import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';

import { DEFAULT_EVERYONE_PERMISSIONS, Permission, type Channel } from '@nestcord/shared';

import { ChannelMenu } from './ChannelMenu';

const MANAGER = DEFAULT_EVERYONE_PERMISSIONS | Permission.MANAGE_CHANNELS;

function channel(permissions: number, overrides: Partial<Channel> = {}): Channel {
  return {
    id: 'channel-1',
    serverId: 'server-1',
    name: 'general',
    type: 'TEXT',
    topic: null,
    position: 0,
    parentId: null,
    permissions,
    ...overrides,
  };
}

function drawChannelRow(permissions: number) {
  return render(
    <ChannelMenu channel={channel(permissions)} onEdit={() => {}}>
      <a href="/app/server-1/channel-1">general</a>
    </ChannelMenu>,
  );
}

describe('ChannelMenu on a channel row', () => {
  it('leaves a left click to navigation, even for someone who can manage it', async () => {
    // The regression this guards: the actions used to open on left click, so a
    // moderator could not switch channels without the menu landing on top.
    drawChannelRow(MANAGER);

    await userEvent.click(screen.getByRole('link', { name: 'general' }));

    expect(screen.queryByRole('menu')).toBeNull();
  });

  it('opens the actions on a right click', async () => {
    drawChannelRow(MANAGER);

    await userEvent.pointer({
      keys: '[MouseRight]',
      target: screen.getByRole('link', { name: 'general' }),
    });

    expect(await screen.findByRole('menuitem', { name: /edit channel/i })).toBeInTheDocument();
  });

  it('offers permissions alone to someone who can only manage roles', async () => {
    drawChannelRow(DEFAULT_EVERYONE_PERMISSIONS | Permission.MANAGE_ROLES);

    await userEvent.pointer({
      keys: '[MouseRight]',
      target: screen.getByRole('link', { name: 'general' }),
    });

    expect(await screen.findByRole('menuitem', { name: 'Permissions' })).toBeInTheDocument();
    expect(screen.queryByRole('menuitem', { name: /edit channel/i })).toBeNull();
  });

  it('offers nothing at all to a plain member', async () => {
    drawChannelRow(DEFAULT_EVERYONE_PERMISSIONS);

    await userEvent.pointer({
      keys: '[MouseRight]',
      target: screen.getByRole('link', { name: 'general' }),
    });

    expect(screen.queryByRole('menu')).toBeNull();
  });
});

describe('ChannelMenu on a category heading', () => {
  it('opens on a left click, because a heading navigates nowhere', async () => {
    render(
      <ChannelMenu
        channel={channel(MANAGER, { type: 'CATEGORY', name: 'Text channels' })}
        onEdit={() => {}}
        onCreateInside={() => {}}
        trigger="click"
      >
        <button type="button">Text channels</button>
      </ChannelMenu>,
    );

    await userEvent.click(screen.getByRole('button', { name: 'Text channels' }));

    expect(await screen.findByRole('menuitem', { name: /edit category/i })).toBeInTheDocument();
    expect(screen.getByRole('menuitem', { name: /create channel here/i })).toBeInTheDocument();
  });
});
