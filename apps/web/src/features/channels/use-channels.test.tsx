import type { ReactNode } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { Permission, type Channel } from '@nestcord/shared';

import {
  groupByCategory,
  useCreateChannel,
  useSetRoleOverride,
  useUpdateChannel,
} from './use-channels';

const SERVER = 'server-1';
const CHANNEL = 'channel-1';

interface Call {
  path: string;
  method: string | undefined;
  body: Record<string, unknown>;
}

/** Records what each mutation actually puts on the wire. */
function stubApi(): Call[] {
  const calls: Call[] = [];

  vi.stubGlobal(
    'fetch',
    vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
      calls.push({
        path: String(input),
        method: init?.method,
        body: init?.body ? (JSON.parse(String(init.body)) as Record<string, unknown>) : {},
      });

      return Promise.resolve(
        new Response(JSON.stringify({ id: CHANNEL }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        }),
      );
    }),
  );

  return calls;
}

function wrapper({ children }: { children: ReactNode }) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });

  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
}

function channel(overrides: Partial<Channel> = {}): Channel {
  return {
    id: 'channel-general',
    serverId: SERVER,
    name: 'general',
    type: 'TEXT',
    topic: null,
    position: 0,
    parentId: null,
    permissions: Permission.VIEW_CHANNEL,
    ...overrides,
  };
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('useUpdateChannel', () => {
  /**
   * The API validates with `forbidNonWhitelisted`, so a field the DTO does not
   * declare is a 400 rather than something it quietly ignores. `channelId` identifies
   * the channel in the path and must not be repeated in the body.
   */
  it('sends the channel id in the path only, never in the body', async () => {
    const calls = stubApi();
    const { result } = renderHook(() => useUpdateChannel(SERVER), { wrapper });

    result.current.mutate({ channelId: 'channel-9', name: 'ideas', topic: null });

    await waitFor(() => expect(calls).toHaveLength(1));

    expect(calls[0]?.path).toBe(`/api/servers/${SERVER}/channels/channel-9`);
    expect(calls[0]?.method).toBe('PATCH');
    expect(calls[0]?.body).toEqual({ name: 'ideas', topic: null });
    expect(calls[0]?.body).not.toHaveProperty('channelId');
  });
});

describe('useCreateChannel', () => {
  it('posts the channel fields to the server’s channel list', async () => {
    const calls = stubApi();
    const { result } = renderHook(() => useCreateChannel(SERVER), { wrapper });

    result.current.mutate({ name: 'Bug Reports', type: 'TEXT', parentId: null });

    await waitFor(() => expect(calls).toHaveLength(1));

    expect(calls[0]?.path).toBe(`/api/servers/${SERVER}/channels`);
    expect(calls[0]?.method).toBe('POST');
    expect(calls[0]?.body).toEqual({ name: 'Bug Reports', type: 'TEXT', parentId: null });
  });
});

describe('useSetRoleOverride', () => {
  it('puts the role id in the path and only the bitfields in the body', async () => {
    const calls = stubApi();
    const { result } = renderHook(() => useSetRoleOverride(SERVER, CHANNEL), { wrapper });

    result.current.mutate({ roleId: 'role-9', allow: 1, deny: 2 });

    await waitFor(() => expect(calls).toHaveLength(1));

    expect(calls[0]?.path).toBe(
      `/api/servers/${SERVER}/channels/${CHANNEL}/permissions/roles/role-9`,
    );
    expect(calls[0]?.method).toBe('PUT');
    expect(calls[0]?.body).toEqual({ allow: 1, deny: 2 });
  });
});

describe('groupByCategory', () => {
  it('puts each channel under its category, in the order given', () => {
    const groups = groupByCategory([
      channel({ id: 'cat-1', name: 'Text', type: 'CATEGORY' }),
      channel({ id: 'chan-1', name: 'general', parentId: 'cat-1' }),
      channel({ id: 'chan-2', name: 'random', parentId: 'cat-1' }),
    ]);

    expect(groups).toHaveLength(1);
    expect(groups[0]?.category?.id).toBe('cat-1');
    expect(groups[0]?.channels.map((entry) => entry.id)).toEqual(['chan-1', 'chan-2']);
  });

  it('lists uncategorised channels first, in their own group', () => {
    const groups = groupByCategory([
      channel({ id: 'chan-loose', name: 'lobby' }),
      channel({ id: 'cat-1', name: 'Text', type: 'CATEGORY' }),
      channel({ id: 'chan-1', name: 'general', parentId: 'cat-1' }),
    ]);

    expect(groups[0]?.category).toBeNull();
    expect(groups[0]?.channels.map((entry) => entry.id)).toEqual(['chan-loose']);
  });

  it('keeps a channel visible when its category is hidden from the member', () => {
    // The API filtered the category out, but not the channel inside it — losing the
    // heading must not lose the channel.
    const groups = groupByCategory([channel({ id: 'chan-1', parentId: 'cat-hidden' })]);

    expect(groups).toHaveLength(1);
    expect(groups[0]?.category).toBeNull();
    expect(groups[0]?.channels.map((entry) => entry.id)).toEqual(['chan-1']);
  });
});
