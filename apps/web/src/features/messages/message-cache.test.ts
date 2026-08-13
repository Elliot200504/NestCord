import { QueryClient } from '@tanstack/react-query';
import { describe, expect, it } from 'vitest';

import type { Message, Paginated, PublicUser } from '@nestcord/shared';

import { keys } from '@/api/keys';
import { prependMessage, replaceMessage, upsertMessage } from './message-cache';

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

function harness(items: Message[]) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });

  queryClient.setQueryData(keys.messages(CHANNEL), {
    pages: [{ items, nextCursor: null } satisfies Paginated<Message>],
    pageParams: [undefined],
  });

  const ids = () =>
    queryClient
      .getQueryData<{ pages: Paginated<Message>[] }>(keys.messages(CHANNEL))
      ?.pages.flatMap((page) => page.items.map((item) => item.id)) ?? [];

  return { queryClient, ids };
}

describe('replaceMessage', () => {
  it('swaps the provisional message for the stored one', () => {
    const { queryClient, ids } = harness([message({ id: 'pending' }), message({ id: 'older' })]);

    replaceMessage(queryClient, CHANNEL, 'pending', message({ id: 'stored' }));

    expect(ids()).toEqual(['stored', 'older']);
  });

  /**
   * The sender receives its own broadcast, and it can arrive before the HTTP response.
   * The socket copy is prepended above the provisional message, so the collapse has to
   * work when the duplicate sits *before* the message being replaced, not only after.
   */
  it('collapses a socket copy that arrived before the send resolved', () => {
    const { queryClient, ids } = harness([message({ id: 'pending' }), message({ id: 'older' })]);

    upsertMessage(queryClient, CHANNEL, message({ id: 'stored' }));
    replaceMessage(queryClient, CHANNEL, 'pending', message({ id: 'stored' }));

    expect(ids()).toEqual(['stored', 'older']);
  });

  it('collapses a socket copy that arrived after the send resolved', () => {
    const { queryClient, ids } = harness([message({ id: 'pending' }), message({ id: 'older' })]);

    replaceMessage(queryClient, CHANNEL, 'pending', message({ id: 'stored' }));
    upsertMessage(queryClient, CHANNEL, message({ id: 'stored' }));

    expect(ids()).toEqual(['stored', 'older']);
  });

  it('keeps the stored message when the provisional copy is already gone', () => {
    const { queryClient, ids } = harness([message({ id: 'stored' })]);

    replaceMessage(queryClient, CHANNEL, 'pending', message({ id: 'stored', content: 'edited' }));

    expect(ids()).toEqual(['stored']);
  });

  it('replaces an edited message in place', () => {
    const { queryClient, ids } = harness([message({ id: 'a' }), message({ id: 'b' })]);

    replaceMessage(queryClient, CHANNEL, 'b', message({ id: 'b', content: 'edited' }));

    expect(ids()).toEqual(['a', 'b']);
  });
});

describe('upsertMessage', () => {
  it('ignores a channel nobody has open', () => {
    const queryClient = new QueryClient();

    upsertMessage(queryClient, CHANNEL, message());

    expect(queryClient.getQueryData(keys.messages(CHANNEL))).toBeUndefined();
  });

  it('does not add a message the cache already holds', () => {
    const { queryClient, ids } = harness([message({ id: 'stored' })]);

    prependMessage(queryClient, CHANNEL, message({ id: 'newer' }));
    upsertMessage(queryClient, CHANNEL, message({ id: 'stored', content: 'same row' }));

    expect(ids()).toEqual(['newer', 'stored']);
  });
});
