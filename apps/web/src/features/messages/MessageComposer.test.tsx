import type { ReactNode } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  DEFAULT_EVERYONE_PERMISSIONS,
  Permission,
  type Channel,
  type PublicUser,
} from '@nestcord/shared';

import { useUiStore } from '@/stores/ui-store';
import { MessageComposer } from './MessageComposer';

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

function channel(permissions = DEFAULT_EVERYONE_PERMISSIONS): Channel {
  return {
    id: CHANNEL,
    serverId: SERVER,
    name: 'general',
    type: 'TEXT',
    topic: null,
    position: 0,
    parentId: null,
    permissions,
  };
}

interface Call {
  method: string | undefined;
  body: Record<string, unknown>;
}

function stubApi(): Call[] {
  const calls: Call[] = [];

  vi.stubGlobal(
    'fetch',
    vi.fn((_input: RequestInfo | URL, init?: RequestInit) => {
      calls.push({
        method: init?.method,
        body:
          init?.body && typeof init.body === 'string'
            ? (JSON.parse(init.body) as Record<string, unknown>)
            : {},
      });

      return Promise.resolve(
        new Response(JSON.stringify({ id: 'sent' }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        }),
      );
    }),
  );

  return calls;
}

function draw(target: Channel = channel()) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });

  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );

  return render(<MessageComposer serverId={SERVER} channel={target} author={AUTHOR} />, {
    wrapper,
  });
}

beforeEach(() => useUiStore.setState({ replyTargets: {} }));
afterEach(() => vi.unstubAllGlobals());

describe('MessageComposer', () => {
  it('sends what was typed when Enter is pressed', async () => {
    const calls = stubApi();
    draw();

    await userEvent.type(screen.getByLabelText('Message #general'), 'hello there{Enter}');

    await waitFor(() => expect(calls).toHaveLength(1));
    expect(calls[0]?.body).toEqual({ content: 'hello there' });
  });

  it('clears the box after sending', async () => {
    stubApi();
    draw();

    const box = screen.getByLabelText('Message #general');
    await userEvent.type(box, 'hello{Enter}');

    await waitFor(() => expect(box).toHaveValue(''));
  });

  it('inserts a newline on Shift+Enter instead of sending', async () => {
    const calls = stubApi();
    draw();

    const box = screen.getByLabelText('Message #general');
    await userEvent.type(box, 'first{Shift>}{Enter}{/Shift}second');

    expect(box).toHaveValue('first\nsecond');
    expect(calls).toHaveLength(0);
  });

  it('will not send an empty message', async () => {
    const calls = stubApi();
    draw();

    await userEvent.type(screen.getByLabelText('Message #general'), '   {Enter}');

    expect(calls).toHaveLength(0);
    expect(screen.getByLabelText('Send message')).toBeDisabled();
  });

  it('sends the reply target when one is pending', async () => {
    const calls = stubApi();
    useUiStore.setState({
      replyTargets: { [CHANNEL]: { messageId: 'message-7', author: 'grace' } },
    });
    draw();

    expect(screen.getByText('grace')).toBeInTheDocument();
    await userEvent.type(screen.getByLabelText('Message #general'), 'answering{Enter}');

    await waitFor(() => expect(calls).toHaveLength(1));
    expect(calls[0]?.body).toEqual({ content: 'answering', replyToId: 'message-7' });
  });

  it('forgets the reply once it has been sent', async () => {
    stubApi();
    useUiStore.setState({
      replyTargets: { [CHANNEL]: { messageId: 'message-7', author: 'grace' } },
    });
    draw();

    await userEvent.type(screen.getByLabelText('Message #general'), 'answering{Enter}');

    await waitFor(() => expect(useUiStore.getState().replyTargets[CHANNEL]).toBeUndefined());
  });

  it('offers no box at all without SEND_MESSAGES', () => {
    draw(channel(Permission.VIEW_CHANNEL));

    expect(screen.queryByLabelText('Message #general')).toBeNull();
    expect(screen.getByText(/do not have permission/i)).toBeInTheDocument();
  });

  it('offers no attachment button without ATTACH_FILES', () => {
    draw(channel(Permission.VIEW_CHANNEL | Permission.SEND_MESSAGES));

    expect(screen.queryByLabelText('Add an attachment')).toBeNull();
    expect(screen.getByLabelText('Message #general')).toBeInTheDocument();
  });
});
