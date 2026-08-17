import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { createMemoryHistory, createRouter, RouterProvider } from '@tanstack/react-router';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { Permission, type Channel, type CurrentUser, type Server } from '@nestcord/shared';

import { setAccessToken } from '@/api/client';
import { routeTree } from '@/router';
import { useUiStore } from '@/stores/ui-store';
import { stubMatchMedia } from '@/test/setup';

const SERVER = '11111111-1111-4111-8111-111111111111';
const GENERAL = '22222222-2222-4222-8222-222222222222';
const RANDOM = '33333333-3333-4333-8333-333333333333';

const ME: CurrentUser = {
  id: 'user-ada',
  username: 'ada',
  displayName: null,
  avatarUrl: null,
  accentColor: null,
  status: 'ONLINE',
  bio: null,
  email: 'ada@example.com',
  createdAt: '2026-01-01T00:00:00.000Z',
};

const SERVER_BODY: Server = {
  id: SERVER,
  name: 'Hearth',
  iconUrl: null,
  ownerId: ME.id,
  createdAt: '2026-01-01T00:00:00.000Z',
  memberCount: 1,
  roles: [],
  permissions: Permission.VIEW_CHANNEL,
};

function channel(id: string, name: string): Channel {
  return {
    id,
    serverId: SERVER,
    name,
    type: 'TEXT',
    topic: null,
    position: 0,
    parentId: null,
    permissions: Permission.VIEW_CHANNEL | Permission.SEND_MESSAGES,
  };
}

function json(body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
}

/** Answers everything the server shell asks for on the way to a channel. */
function stubApi(): void {
  const handlers: Record<string, () => Response> = {
    '/api/users/me': () => json(ME),
    '/api/servers': () => json([SERVER_BODY]),
    [`/api/servers/${SERVER}`]: () => json(SERVER_BODY),
    [`/api/servers/${SERVER}/channels`]: () =>
      json([channel(GENERAL, 'general'), channel(RANDOM, 'random')]),
    [`/api/servers/${SERVER}/members`]: () =>
      json([{ user: ME, nickname: null, joinedAt: ME.createdAt, roleIds: [] }]),
    [`/api/servers/${SERVER}/channels/${GENERAL}`]: () => json(channel(GENERAL, 'general')),
    [`/api/servers/${SERVER}/channels/${RANDOM}`]: () => json(channel(RANDOM, 'random')),
    // History is paginated, so an empty array here would break the page reader.
    [`/api/servers/${SERVER}/channels/${GENERAL}/messages`]: () =>
      json({ items: [], nextCursor: null }),
    [`/api/servers/${SERVER}/channels/${RANDOM}/messages`]: () =>
      json({ items: [], nextCursor: null }),
    '/api/notifications': () => json([]),
    '/api/friends': () => json([]),
    '/api/conversations': () => json([]),
  };

  vi.stubGlobal(
    'fetch',
    vi.fn((input: RequestInfo | URL) => {
      const path = String(input).split('?')[0] ?? '';
      const handler = handlers[path];

      return Promise.resolve(handler ? handler() : json([]));
    }),
  );
}

async function renderChannel() {
  const router = createRouter({
    routeTree,
    history: createMemoryHistory({ initialEntries: [`/app/${SERVER}/${GENERAL}`] }),
  });

  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });

  render(
    <QueryClientProvider client={queryClient}>
      {/* The router type is registered for the app's own instance, not this one. */}
      <RouterProvider router={router as never} />
    </QueryClientProvider>,
  );

  // The channel list is what every test here acts on, so wait for it to arrive.
  await screen.findByRole('link', { name: 'general' });

  return router;
}

describe('the app shell on a wide viewport', () => {
  beforeEach(() => {
    stubMatchMedia(true);
    setAccessToken('access-token');
    stubApi();
  });

  afterEach(() => {
    setAccessToken(null);
    vi.unstubAllGlobals();
    useUiStore.setState({ memberListOpen: true, drawer: null });
  });

  it('keeps the channel list on screen with nothing to open it', async () => {
    await renderChannel();

    expect(screen.getByRole('navigation', { name: 'Channels' })).toBeInTheDocument();
    // The column is already there, so a button that opens it would do nothing.
    expect(screen.queryByRole('button', { name: 'Open the channel list' })).not.toBeInTheDocument();
  });

  it('collapses and restores the member list column', async () => {
    await renderChannel();

    expect(await screen.findByRole('complementary', { name: 'Members' })).toBeInTheDocument();

    const toggle = screen.getByRole('button', { name: 'Hide the member list' });
    await userEvent.click(toggle);

    expect(screen.queryByRole('complementary', { name: 'Members' })).not.toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: 'Show the member list' }));

    expect(screen.getByRole('complementary', { name: 'Members' })).toBeInTheDocument();
  });
});

describe('the app shell on a narrow viewport', () => {
  beforeEach(() => {
    stubMatchMedia(false);
    setAccessToken('access-token');
    stubApi();
  });

  afterEach(() => {
    setAccessToken(null);
    vi.unstubAllGlobals();
    stubMatchMedia(true);
    useUiStore.setState({ memberListOpen: true, drawer: null });
  });

  it('hides the channel list behind a button', async () => {
    // Rendered once so the drawer can be opened, then closed again below.
    useUiStore.setState({ drawer: 'channels' });
    await renderChannel();

    await userEvent.click(screen.getByRole('button', { name: 'Close the channel list' }));

    expect(screen.queryByRole('navigation', { name: 'Channels' })).not.toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: 'Open the channel list' }));

    expect(await screen.findByRole('navigation', { name: 'Channels' })).toBeInTheDocument();
  });

  it('closes the drawer once a channel is picked', async () => {
    useUiStore.setState({ drawer: 'channels' });
    await renderChannel();

    await userEvent.click(screen.getByRole('link', { name: 'random' }));

    // Leaving it open would cover the channel the reader just asked to see.
    await waitFor(() => expect(useUiStore.getState().drawer).toBeNull());
    expect(screen.queryByRole('navigation', { name: 'Channels' })).not.toBeInTheDocument();
  });

  it('closes the drawer on Escape', async () => {
    useUiStore.setState({ drawer: 'channels' });
    await renderChannel();

    await userEvent.keyboard('{Escape}');

    await waitFor(() => expect(useUiStore.getState().drawer).toBeNull());
  });

  it('opens the member list over the messages rather than beside them', async () => {
    useUiStore.setState({ drawer: 'channels' });
    await renderChannel();

    // memberListOpen is true, but there is no room for a column at this width.
    expect(screen.queryByRole('complementary', { name: 'Members' })).not.toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: 'Show the member list' }));

    expect(await screen.findByRole('complementary', { name: 'Members' })).toBeInTheDocument();
    // One overlay at a time: the channel drawer gives way to the member list.
    expect(useUiStore.getState().drawer).toBe('members');
  });
});
