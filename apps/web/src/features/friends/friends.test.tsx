import type { ReactNode } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';

import type { Friend, PublicUser } from '@nestcord/shared';

import { FriendsPage } from './FriendsPage';
import { friendsForTab, incomingCount } from './use-friends';

const ADA = 'user-ada';
const GRACE = 'user-grace';

function user(id: string, username: string, overrides: Partial<PublicUser> = {}): PublicUser {
  return {
    id,
    username,
    displayName: null,
    avatarUrl: null,
    accentColor: null,
    status: 'ONLINE',
    ...overrides,
  };
}

function friend(overrides: Partial<Friend> = {}): Friend {
  return {
    id: 'friendship-1',
    user: user(GRACE, 'grace'),
    status: 'ACCEPTED',
    direction: 'OUTGOING',
    createdAt: '2026-08-13T09:00:00.000Z',
    ...overrides,
  };
}

interface Call {
  path: string;
  method: string | undefined;
}

/** Answers `GET /friends` with the given list and records every write. */
function stubApi(friends: Friend[]): Call[] {
  const calls: Call[] = [];

  vi.stubGlobal(
    'fetch',
    vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
      const path = String(input);
      calls.push({ path, method: init?.method });

      const body = init?.method && init.method !== 'GET' ? friends[0] : friends;

      return Promise.resolve(
        new Response(JSON.stringify(body ?? null), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        }),
      );
    }),
  );

  return calls;
}

function renderPage() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });

  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );

  return render(<FriendsPage />, { wrapper });
}

afterEach(() => vi.unstubAllGlobals());

describe('FriendsPage', () => {
  it('shows friends who are online on the default tab', async () => {
    stubApi([friend()]);
    renderPage();

    expect(await screen.findByText('grace')).toBeInTheDocument();
  });

  it('leaves an offline friend off the online tab', async () => {
    stubApi([friend({ user: user(GRACE, 'grace', { status: 'OFFLINE' }) })]);
    renderPage();

    expect(await screen.findByText(/none of your friends are online/i)).toBeInTheDocument();
  });

  it('counts requests waiting on you next to the pending tab', async () => {
    stubApi([friend({ status: 'PENDING', direction: 'INCOMING' })]);
    renderPage();

    // The tab exists before the list arrives, so this waits for the count itself
    // rather than for the button.
    await waitFor(() =>
      expect(screen.getByRole('button', { name: /pending/i })).toHaveTextContent('1'),
    );
  });

  it('offers accept and reject for an incoming request', async () => {
    stubApi([friend({ status: 'PENDING', direction: 'INCOMING' })]);
    renderPage();

    await userEvent.click(await screen.findByRole('button', { name: /pending/i }));

    expect(screen.getByRole('button', { name: 'Accept grace' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Reject request from grace' })).toBeInTheDocument();
  });

  it('does not offer accept for a request you sent', async () => {
    stubApi([friend({ status: 'PENDING', direction: 'OUTGOING' })]);
    renderPage();

    await userEvent.click(await screen.findByRole('button', { name: /pending/i }));

    expect(screen.queryByRole('button', { name: 'Accept grace' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Withdraw request to grace' })).toBeInTheDocument();
  });

  it('accepts a request through the API', async () => {
    const calls = stubApi([friend({ status: 'PENDING', direction: 'INCOMING' })]);
    renderPage();

    await userEvent.click(await screen.findByRole('button', { name: /pending/i }));
    await userEvent.click(screen.getByRole('button', { name: 'Accept grace' }));

    await waitFor(() =>
      expect(calls).toContainEqual({ path: `/api/friends/${GRACE}/accept`, method: 'POST' }),
    );
  });

  it('sends a request from the add form', async () => {
    const calls = stubApi([]);
    renderPage();

    await userEvent.click(await screen.findByRole('button', { name: /add friend/i }));
    await userEvent.type(screen.getByLabelText(/add a friend/i), 'grace');
    await userEvent.click(screen.getByRole('button', { name: /send request/i }));

    await waitFor(() => expect(calls).toContainEqual({ path: '/api/friends', method: 'POST' }));
  });

  it('shows why the server refused a request', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn((_input: RequestInfo | URL, init?: RequestInit) =>
        Promise.resolve(
          new Response(
            JSON.stringify(init?.method === 'POST' ? { message: 'No user by that name' } : []),
            {
              status: init?.method === 'POST' ? 404 : 200,
              headers: { 'Content-Type': 'application/json' },
            },
          ),
        ),
      ),
    );

    renderPage();

    await userEvent.click(await screen.findByRole('button', { name: /add friend/i }));
    await userEvent.type(screen.getByLabelText(/add a friend/i), 'nobody');
    await userEvent.click(screen.getByRole('button', { name: /send request/i }));

    expect(await screen.findByRole('alert')).toHaveTextContent('No user by that name');
  });

  it('offers unblock, and nothing else, for someone you blocked', async () => {
    stubApi([friend({ status: 'BLOCKED', direction: 'OUTGOING' })]);
    renderPage();

    await userEvent.click(await screen.findByRole('button', { name: /blocked/i }));

    expect(screen.getByRole('button', { name: 'Unblock' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Block grace' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Remove grace' })).not.toBeInTheDocument();
  });
});

describe('friendsForTab', () => {
  const accepted = friend({ id: 'a', status: 'ACCEPTED' });
  const offline = friend({
    id: 'b',
    status: 'ACCEPTED',
    user: user(ADA, 'ada', { status: 'OFFLINE' }),
  });
  const pending = friend({ id: 'c', status: 'PENDING', direction: 'INCOMING' });
  const blocked = friend({ id: 'd', status: 'BLOCKED' });
  const all = [accepted, offline, pending, blocked];

  it('shows only accepted friends who are online', () => {
    expect(friendsForTab(all, 'online')).toEqual([accepted]);
  });

  it('shows every accepted friend regardless of presence', () => {
    expect(friendsForTab(all, 'all')).toEqual([accepted, offline]);
  });

  it('separates pending requests from friends', () => {
    expect(friendsForTab(all, 'pending')).toEqual([pending]);
  });

  it('separates blocked users from friends', () => {
    expect(friendsForTab(all, 'blocked')).toEqual([blocked]);
  });
});

describe('incomingCount', () => {
  it('counts only requests other people sent you', () => {
    const friends = [
      friend({ id: 'a', status: 'PENDING', direction: 'INCOMING' }),
      friend({ id: 'b', status: 'PENDING', direction: 'OUTGOING' }),
      friend({ id: 'c', status: 'ACCEPTED' }),
    ];

    expect(incomingCount(friends)).toBe(1);
  });
});
