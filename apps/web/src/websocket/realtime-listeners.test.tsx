import { QueryClient } from '@tanstack/react-query';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { SocketEvent, type Message, type Paginated } from '@nestcord/shared';

import { keys } from '@/api/keys';
import { useTypingStore } from '@/stores/typing-store';
import { registerRealtimeListeners } from './realtime-listeners';

const CHANNEL = 'channel-1';
const VIEWER = 'user-ada';

const ADA = {
  id: VIEWER,
  username: 'ada',
  displayName: null,
  avatarUrl: null,
  accentColor: null,
  status: 'ONLINE' as const,
};

const GRACE = { ...ADA, id: 'user-grace', username: 'grace' };

function message(overrides: Partial<Message> = {}): Message {
  return {
    id: 'message-1',
    channelId: CHANNEL,
    conversationId: null,
    author: GRACE,
    content: 'hello',
    createdAt: '2026-08-12T09:00:00.000Z',
    editedAt: null,
    replyTo: null,
    attachments: [],
    reactions: [],
    ...overrides,
  };
}

/** A socket, as far as the listeners use one. */
function fakeSocket() {
  const handlers = new Map<string, Array<(payload: unknown) => void>>();

  return {
    socket: {
      on: (event: string, handler: (payload: unknown) => void) => {
        handlers.set(event, [...(handlers.get(event) ?? []), handler]);
      },
      off: (event: string) => handlers.delete(event),
    },
    /** Delivers an event the way the server would. */
    deliver: (event: string, payload: unknown) => {
      for (const handler of handlers.get(event) ?? []) handler(payload);
    },
    has: (event: string) => handlers.has(event),
  };
}

function buildHarness(items: Message[] = []) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });

  queryClient.setQueryData(keys.messages(CHANNEL), {
    pages: [{ items, nextCursor: null } satisfies Paginated<Message>],
    pageParams: [undefined],
  });

  const { socket, deliver, has } = fakeSocket();
  const unregister = registerRealtimeListeners(socket as never, queryClient, VIEWER);

  const messages = () =>
    queryClient.getQueryData<{ pages: Paginated<Message>[] }>(keys.messages(CHANNEL))?.pages[0]
      ?.items ?? [];

  return { queryClient, deliver, has, unregister, messages };
}

beforeEach(() => useTypingStore.setState({ byChannel: {} }));
afterEach(() => useTypingStore.getState().clear());

describe('message events', () => {
  it('adds a message someone else sent', () => {
    const { deliver, messages } = buildHarness();

    deliver(SocketEvent.MESSAGE_CREATE, message());

    expect(messages().map((item) => item.id)).toEqual(['message-1']);
  });

  it('does not duplicate a message this client already has', () => {
    // The sender receives its own broadcast, so this is the second copy of a message
    // that was already shown optimistically.
    const { deliver, messages } = buildHarness([message()]);

    deliver(SocketEvent.MESSAGE_CREATE, message());

    expect(messages()).toHaveLength(1);
  });

  it('applies an edit in place', () => {
    const { deliver, messages } = buildHarness([message()]);

    deliver(SocketEvent.MESSAGE_UPDATE, message({ content: 'fixed', editedAt: 'now' }));

    expect(messages()[0]?.content).toBe('fixed');
  });

  it('keeps the viewer’s own reaction flags through an edit', () => {
    // A broadcast cannot know whether *this* reader reacted, so an edit must not
    // overwrite what the client already resolved.
    const { deliver, messages } = buildHarness([
      message({ reactions: [{ emoji: '👍', count: 1, me: true }] }),
    ]);

    deliver(SocketEvent.MESSAGE_UPDATE, message({ content: 'fixed' }));

    expect(messages()[0]?.reactions).toEqual([{ emoji: '👍', count: 1, me: true }]);
  });

  it('removes a deleted message', () => {
    const { deliver, messages } = buildHarness([message()]);

    deliver(SocketEvent.MESSAGE_DELETE, { channelId: CHANNEL, messageId: 'message-1' });

    expect(messages()).toEqual([]);
  });
});

describe('reaction events', () => {
  it('counts someone else’s reaction without claiming it as yours', () => {
    const { deliver, messages } = buildHarness([message()]);

    deliver(SocketEvent.REACTION_ADD, {
      channelId: CHANNEL,
      messageId: 'message-1',
      emoji: '👍',
      userId: GRACE.id,
    });

    expect(messages()[0]?.reactions).toEqual([{ emoji: '👍', count: 1, me: false }]);
  });

  it('marks a reaction as yours when the reactor is you', () => {
    const { deliver, messages } = buildHarness([message()]);

    deliver(SocketEvent.REACTION_ADD, {
      channelId: CHANNEL,
      messageId: 'message-1',
      emoji: '👍',
      userId: VIEWER,
    });

    expect(messages()[0]?.reactions).toEqual([{ emoji: '👍', count: 1, me: true }]);
  });

  it('does not double-count your own reaction you already applied optimistically', () => {
    const { deliver, messages } = buildHarness([
      message({ reactions: [{ emoji: '👍', count: 1, me: true }] }),
    ]);

    deliver(SocketEvent.REACTION_ADD, {
      channelId: CHANNEL,
      messageId: 'message-1',
      emoji: '👍',
      userId: VIEWER,
    });

    expect(messages()[0]?.reactions).toEqual([{ emoji: '👍', count: 1, me: true }]);
  });

  it('drops the button when the last reactor takes theirs back', () => {
    const { deliver, messages } = buildHarness([
      message({ reactions: [{ emoji: '👍', count: 1, me: false }] }),
    ]);

    deliver(SocketEvent.REACTION_REMOVE, {
      channelId: CHANNEL,
      messageId: 'message-1',
      emoji: '👍',
      userId: GRACE.id,
    });

    expect(messages()[0]?.reactions).toEqual([]);
  });
});

describe('typing events', () => {
  it('records who is typing where', () => {
    const { deliver } = buildHarness();

    deliver(SocketEvent.TYPING_START, { channelId: CHANNEL, user: GRACE });

    expect(useTypingStore.getState().byChannel[CHANNEL]?.[GRACE.id]?.user).toEqual(GRACE);
  });

  it('takes the indicator down on a stop', () => {
    const { deliver } = buildHarness();

    deliver(SocketEvent.TYPING_START, { channelId: CHANNEL, user: GRACE });
    deliver(SocketEvent.TYPING_STOP, { channelId: CHANNEL, user: GRACE });

    expect(useTypingStore.getState().byChannel[CHANNEL]?.[GRACE.id]).toBeUndefined();
  });

  it('clears every indicator when the connection drops', () => {
    const { deliver } = buildHarness();

    deliver(SocketEvent.TYPING_START, { channelId: CHANNEL, user: GRACE });
    deliver('disconnect', undefined);

    expect(useTypingStore.getState().byChannel).toEqual({});
  });
});

describe('presence events', () => {
  it('patches a loaded member list rather than refetching it', () => {
    const { queryClient, deliver } = buildHarness();
    queryClient.setQueryData(keys.members('server-1'), [
      { user: GRACE, nickname: null, joinedAt: '', roleIds: [] },
    ]);

    deliver(SocketEvent.PRESENCE_UPDATE, { userId: GRACE.id, status: 'IDLE' });

    const members = queryClient.getQueryData<Array<{ user: { status: string } }>>(
      keys.members('server-1'),
    );
    expect(members?.[0]?.user.status).toBe('IDLE');
  });

  it('leaves other members alone', () => {
    const { queryClient, deliver } = buildHarness();
    queryClient.setQueryData(keys.members('server-1'), [
      { user: GRACE, nickname: null, joinedAt: '', roleIds: [] },
      { user: ADA, nickname: null, joinedAt: '', roleIds: [] },
    ]);

    deliver(SocketEvent.PRESENCE_UPDATE, { userId: GRACE.id, status: 'OFFLINE' });

    const members = queryClient.getQueryData<Array<{ user: { status: string } }>>(
      keys.members('server-1'),
    );
    expect(members?.[1]?.user.status).toBe('ONLINE');
  });
});

describe('notification events', () => {
  it('puts a new notification at the top of the list', () => {
    const { queryClient, deliver } = buildHarness();

    deliver(SocketEvent.NOTIFICATION_CREATE, { id: 'notification-1', type: 'MENTION' });

    expect(queryClient.getQueryData<unknown[]>(keys.notifications)).toHaveLength(1);
  });
});

describe('teardown', () => {
  it('removes every listener it added', () => {
    const { unregister, has } = buildHarness();

    unregister();

    expect(has(SocketEvent.MESSAGE_CREATE)).toBe(false);
    expect(has(SocketEvent.PRESENCE_UPDATE)).toBe(false);
    expect(has('connect')).toBe(false);
  });
});
