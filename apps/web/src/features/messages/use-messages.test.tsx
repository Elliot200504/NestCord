import type { ReactNode } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import type { Message, Paginated, PublicUser } from '@nestcord/shared';

import { keys } from '@/api/keys';
import { toggleReaction } from './message-cache';
import { useSendMessage, useToggleReaction } from './use-messages';

const SERVER = 'server-1';
const CHANNEL = 'channel-1';

const AUTHOR: PublicUser = {
  id: 'user-ada',
  username: 'ada',
  displayName: null,
  avatarUrl: null,
  accentColor: null,
  status: 'ONLINE',
};

function message(overrides: Partial<Message> = {}): Message {
  return {
    id: 'message-1',
    channelId: CHANNEL,
    author: AUTHOR,
    content: 'hello',
    createdAt: '2026-08-12T09:00:00.000Z',
    editedAt: null,
    replyTo: null,
    attachments: [],
    reactions: [],
    ...overrides,
  };
}

interface Call {
  path: string;
  method: string | undefined;
  body: Record<string, unknown>;
}

/** Records what each mutation actually puts on the wire. */
function stubApi(response: unknown, options: { fail?: boolean } = {}): Call[] {
  const calls: Call[] = [];

  vi.stubGlobal(
    'fetch',
    vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
      calls.push({
        path: String(input),
        method: init?.method,
        body:
          init?.body && typeof init.body === 'string'
            ? (JSON.parse(init.body) as Record<string, unknown>)
            : {},
      });

      return Promise.resolve(
        new Response(JSON.stringify(options.fail ? { message: 'nope' } : response), {
          status: options.fail ? 403 : 200,
          headers: { 'Content-Type': 'application/json' },
        }),
      );
    }),
  );

  return calls;
}

function harness(page: Paginated<Message>) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });

  queryClient.setQueryData(keys.messages(CHANNEL), {
    pages: [page],
    pageParams: [undefined],
  });

  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );

  const messages = () =>
    queryClient.getQueryData<{ pages: Paginated<Message>[] }>(keys.messages(CHANNEL))?.pages[0]
      ?.items ?? [];

  return { queryClient, wrapper, messages };
}

afterEach(() => vi.unstubAllGlobals());

describe('useSendMessage', () => {
  it('shows the message before the server answers', async () => {
    stubApi(message({ id: 'stored', content: 'hi there' }));
    const { wrapper, messages } = harness({ items: [], nextCursor: null });

    const { result } = renderHook(() => useSendMessage(SERVER, CHANNEL, AUTHOR), { wrapper });
    result.current.mutate({ content: 'hi there' });

    await waitFor(() => expect(messages()).toHaveLength(1));
    expect(messages()[0]?.content).toBe('hi there');
  });

  it('swaps the provisional copy for the stored one', async () => {
    stubApi(message({ id: 'stored', content: 'hi there' }));
    const { wrapper, messages } = harness({ items: [], nextCursor: null });

    const { result } = renderHook(() => useSendMessage(SERVER, CHANNEL, AUTHOR), { wrapper });
    result.current.mutate({ content: 'hi there' });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(messages().map((item) => item.id)).toEqual(['stored']);
  });

  it('takes the message back out when the send is refused', async () => {
    stubApi(null, { fail: true });
    const { wrapper, messages } = harness({ items: [], nextCursor: null });

    const { result } = renderHook(() => useSendMessage(SERVER, CHANNEL, AUTHOR), { wrapper });
    result.current.mutate({ content: 'not allowed' });

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(messages()).toHaveLength(0);
  });

  it('sends the reply target and attachments as given', async () => {
    const calls = stubApi(message());
    const { wrapper } = harness({ items: [], nextCursor: null });

    const { result } = renderHook(() => useSendMessage(SERVER, CHANNEL, AUTHOR), { wrapper });
    result.current.mutate({ content: 'answer', replyToId: 'message-1', attachmentIds: ['file-1'] });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(calls[0]?.path).toBe(`/api/servers/${SERVER}/channels/${CHANNEL}/messages`);
    expect(calls[0]?.body).toEqual({
      content: 'answer',
      replyToId: 'message-1',
      attachmentIds: ['file-1'],
    });
  });
});

describe('useToggleReaction', () => {
  it('adds a reaction and puts it on the wire encoded', async () => {
    const calls = stubApi([{ emoji: '👍', count: 1, me: true }]);
    const { wrapper, messages } = harness({ items: [message()], nextCursor: null });

    const { result } = renderHook(() => useToggleReaction(SERVER, CHANNEL), { wrapper });
    result.current.mutate({ message: message(), emoji: '👍' });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(messages()[0]?.reactions).toEqual([{ emoji: '👍', count: 1, me: true }]);
    expect(calls[0]?.method).toBe('PUT');
    expect(calls[0]?.path).toContain(encodeURIComponent('👍'));
  });

  it('takes back a reaction the reader already added', async () => {
    const calls = stubApi([]);
    const existing = message({ reactions: [{ emoji: '👍', count: 1, me: true }] });
    const { wrapper } = harness({ items: [existing], nextCursor: null });

    const { result } = renderHook(() => useToggleReaction(SERVER, CHANNEL), { wrapper });
    result.current.mutate({ message: existing, emoji: '👍' });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(calls[0]?.method).toBe('DELETE');
  });

  it('restores the previous reactions when the server refuses', async () => {
    stubApi(null, { fail: true });
    const { wrapper, messages } = harness({ items: [message()], nextCursor: null });

    const { result } = renderHook(() => useToggleReaction(SERVER, CHANNEL), { wrapper });
    result.current.mutate({ message: message(), emoji: '👍' });

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(messages()[0]?.reactions).toEqual([]);
  });
});

describe('toggleReaction', () => {
  it('adds an emoji nobody has used yet', () => {
    expect(toggleReaction(message(), '🎉').reactions).toEqual([
      { emoji: '🎉', count: 1, me: true },
    ]);
  });

  it('joins an emoji someone else used', () => {
    const existing = message({ reactions: [{ emoji: '🎉', count: 1, me: false }] });

    expect(toggleReaction(existing, '🎉').reactions).toEqual([{ emoji: '🎉', count: 2, me: true }]);
  });

  it('drops the button when the reader was the last reactor', () => {
    const existing = message({ reactions: [{ emoji: '🎉', count: 1, me: true }] });

    expect(toggleReaction(existing, '🎉').reactions).toEqual([]);
  });
});
