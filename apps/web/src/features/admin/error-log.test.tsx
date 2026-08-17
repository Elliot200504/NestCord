import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { createMemoryHistory, createRouter, RouterProvider } from '@tanstack/react-router';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { ErrorLogEntry } from '@nestcord/shared';

import { setAccessToken } from '@/api/client';
import { routeTree } from '@/router';

const USER = {
  id: 'user-1',
  username: 'ada',
  displayName: 'Ada L.',
  avatarUrl: null,
  accentColor: '#e0234e',
  status: 'ONLINE',
  bio: null,
  email: 'ada@nestcord.local',
  createdAt: '2026-01-01T00:00:00.000Z',
};

function entry(overrides: Partial<ErrorLogEntry> = {}): ErrorLogEntry {
  return {
    id: 'error-1',
    reference: 'ERR-9F3A2C',
    statusCode: 500,
    detail: 'Prisma P2010: Raw query failed',
    stack: 'Error: Raw query failed\n    at ChannelsService.create',
    method: 'POST',
    path: '/api/channels',
    userId: 'user-7',
    createdAt: '2026-08-17T09:00:00.000Z',
    ...overrides,
  };
}

type Handler = (init?: RequestInit) => Response;

function stubApi(overrides: Record<string, Handler> = {}) {
  const handlers: Record<string, Handler> = {
    '/api/users/me': () => json(USER),
    '/api/admin/access': () => json({ isAdmin: true }),
    '/api/admin/errors': () => json([entry()]),
    ...overrides,
  };

  vi.stubGlobal(
    'fetch',
    vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
      const handler = handlers[String(input)];

      return Promise.resolve(handler ? handler(init) : json({ message: 'Not found' }, 404));
    }),
  );
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

function renderErrorLog() {
  const router = createRouter({
    routeTree,
    history: createMemoryHistory({ initialEntries: ['/settings/errors'] }),
  });

  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });

  render(
    <QueryClientProvider client={queryClient}>
      {/* The router type is registered for the app's own instance, not this one. */}
      <RouterProvider router={router as never} />
    </QueryClientProvider>,
  );
}

describe('the error log', () => {
  beforeEach(() => {
    setAccessToken('access-token');
  });

  afterEach(() => {
    setAccessToken(null);
    vi.unstubAllGlobals();
  });

  it('lists a failure by the reference the user was shown', async () => {
    stubApi();
    renderErrorLog();

    expect(await screen.findByText('ERR-9F3A2C')).toBeInTheDocument();
    expect(screen.getByText('POST /api/channels')).toBeInTheDocument();
  });

  it('keeps the detail and the stack behind a click', async () => {
    stubApi();
    const user = userEvent.setup();
    renderErrorLog();

    const row = await screen.findByRole('button', { expanded: false });
    expect(screen.queryByText('Prisma P2010: Raw query failed')).not.toBeInTheDocument();

    await user.click(row);

    expect(screen.getByText('Prisma P2010: Raw query failed')).toBeInTheDocument();
    expect(screen.getByText(/at ChannelsService.create/)).toBeInTheDocument();
  });

  it('looks a quoted reference up rather than filtering the page', async () => {
    stubApi({
      '/api/admin/errors/ERR-11AA22': () => json(entry({ reference: 'ERR-11AA22' })),
    });
    const user = userEvent.setup();
    renderErrorLog();

    // Typed lower case, as a user would quote it back.
    await user.type(await screen.findByLabelText('Reference'), 'err-11aa22');

    expect(await screen.findByText('ERR-11AA22')).toBeInTheDocument();
    expect(screen.queryByText('ERR-9F3A2C')).not.toBeInTheDocument();
  });

  it('says plainly when a reference matches nothing', async () => {
    stubApi();
    const user = userEvent.setup();
    renderErrorLog();

    await user.type(await screen.findByLabelText('Reference'), 'ERR-000000');

    expect(await screen.findByText(/No error carries that reference/)).toBeInTheDocument();
  });

  it('tells a non-admin the page is not theirs instead of showing a failure', async () => {
    stubApi({
      '/api/admin/access': () => json({ isAdmin: false }),
      '/api/admin/errors': () => json({ message: 'You do not have access to this' }, 403),
    });
    renderErrorLog();

    expect(await screen.findByText(/This page is for administrators/)).toBeInTheDocument();
    expect(screen.queryByLabelText('Reference')).not.toBeInTheDocument();
  });
});
