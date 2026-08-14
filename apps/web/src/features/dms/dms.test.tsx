import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { createMemoryHistory, createRouter, RouterProvider } from '@tanstack/react-router';
import { render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { Conversation, PublicUser } from '@nestcord/shared';

import { setAccessToken } from '@/api/client';
import { routeTree } from '@/router';
import { conversationAvatar, conversationTitle } from './conversation-title';

const ADA = 'user-ada';
const GRACE = 'user-grace';
const LIN = 'user-lin';

const CONVERSATION = 'aa000000-0000-4000-8000-000000000001';

function user(id: string, username: string, displayName: string | null = null): PublicUser {
  return { id, username, displayName, avatarUrl: null, accentColor: null, status: 'ONLINE' };
}

function conversation(overrides: Partial<Conversation> = {}): Conversation {
  return {
    id: CONVERSATION,
    name: null,
    isGroup: false,
    participants: [user(ADA, 'ada'), user(GRACE, 'grace')],
    createdAt: '2026-08-13T09:00:00.000Z',
    lastMessageAt: null,
    ...overrides,
  };
}

const ME = { ...user(ADA, 'ada'), bio: null, createdAt: '2026-01-01T00:00:00.000Z' };

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

interface Call {
  path: string;
  method: string | undefined;
  body: unknown;
}

/** Answers the endpoints the `@me` shell touches; everything else is an empty list. */
function stubApi(overrides: Record<string, () => Response> = {}): Call[] {
  const calls: Call[] = [];

  const handlers: Record<string, () => Response> = {
    '/api/users/me': () => json(ME),
    '/api/servers': () => json([]),
    '/api/friends': () => json([]),
    '/api/notifications': () => json([]),
    '/api/conversations': () => json([]),
    ...overrides,
  };

  vi.stubGlobal(
    'fetch',
    vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
      const path = String(input);
      calls.push({
        path,
        method: init?.method,
        body: typeof init?.body === 'string' ? JSON.parse(init.body) : undefined,
      });

      const handler = handlers[path];

      return Promise.resolve(handler ? handler() : json([]));
    }),
  );

  return calls;
}

async function renderAt(path: string) {
  const router = createRouter({
    routeTree,
    history: createMemoryHistory({ initialEntries: [path] }),
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

  return router;
}

describe('conversationTitle', () => {
  it('names a one-to-one DM after the other person, never after you', () => {
    expect(conversationTitle(conversation(), ADA)).toBe('grace');
    expect(conversationTitle(conversation(), GRACE)).toBe('ada');
  });

  it('prefers a display name to a username', () => {
    const named = conversation({
      participants: [user(ADA, 'ada'), user(GRACE, 'grace', 'Grace H.')],
    });

    expect(conversationTitle(named, ADA)).toBe('Grace H.');
  });

  it('uses a group’s own name when it has one', () => {
    const group = conversation({ isGroup: true, name: 'the crew' });

    expect(conversationTitle(group, ADA)).toBe('the crew');
  });

  it('falls back to reading out an unnamed group', () => {
    const group = conversation({
      isGroup: true,
      participants: [user(ADA, 'ada'), user(GRACE, 'grace'), user(LIN, 'lin')],
    });

    expect(conversationTitle(group, ADA)).toBe('grace, lin');
  });

  it('gives a group no single face to show', () => {
    // One member's avatar would say the wrong thing about who is in it.
    expect(conversationAvatar(conversation({ isGroup: true }), ADA)).toBeNull();
    expect(conversationAvatar(conversation(), ADA)?.username).toBe('grace');
  });
});

describe('the direct message sidebar', () => {
  beforeEach(() => setAccessToken('access-token'));

  afterEach(() => {
    setAccessToken(null);
    vi.unstubAllGlobals();
  });

  it('lists your conversations under the friends link', async () => {
    stubApi({
      '/api/conversations': () =>
        json([
          conversation(),
          conversation({
            id: 'bb000000-0000-4000-8000-000000000002',
            isGroup: true,
            name: 'the crew',
          }),
        ]),
    });

    await renderAt('/app/@me/friends');

    expect(await screen.findByRole('link', { name: /grace/ })).toBeInTheDocument();
    expect(await screen.findByRole('link', { name: /the crew/ })).toBeInTheDocument();
  });

  it('says so plainly when there are none yet', async () => {
    stubApi();

    await renderAt('/app/@me/friends');

    expect(await screen.findByText(/no conversations yet/i)).toBeInTheDocument();
  });
});
