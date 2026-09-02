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

/**
 * Holds every attachment upload open until released, so the test can see how many
 * were started at once rather than inferring it from timing.
 */
function stubHeldUploads() {
  const started: string[] = [];
  let release = () => {};
  const held = new Promise<void>((resolve) => {
    release = resolve;
  });

  vi.stubGlobal(
    'fetch',
    vi.fn((input: RequestInfo | URL) => {
      const url = String(input);

      if (!url.endsWith('/attachments')) {
        return Promise.resolve(
          new Response(JSON.stringify({ id: 'sent' }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          }),
        );
      }

      const index = started.length;
      started.push(url);

      return held.then(
        () =>
          new Response(
            JSON.stringify({
              id: `attachment-${String(index)}`,
              filename: `file-${String(index)}.png`,
              mimeType: 'image/png',
              size: 1,
              url: `/uploads/file-${String(index)}.png`,
            }),
            { status: 200, headers: { 'Content-Type': 'application/json' } },
          ),
      );
    }),
  );

  return { started, release: () => release() };
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
    expect(calls[0]?.body).toEqual({ content: 'hello there', nonce: expect.any(String) });
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
    expect(calls[0]?.body).toEqual({
      content: 'answering',
      replyToId: 'message-7',
      nonce: expect.any(String),
    });
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

  it('uploads several chosen files at the same time', async () => {
    const { started, release } = stubHeldUploads();
    const { container } = draw();

    const input = container.querySelector('input[type="file"]');
    const files = [0, 1, 2].map(
      (index) => new File(['x'], `file-${String(index)}.png`, { type: 'image/png' }),
    );

    await userEvent.upload(input as HTMLInputElement, files);

    // All three are in flight before any of them has come back. Sequentially
    // there would be exactly one.
    await waitFor(() => expect(started).toHaveLength(3));

    release();
  });

  it('keeps the files in the order they were picked', async () => {
    const { release } = stubHeldUploads();
    const { container } = draw();

    const input = container.querySelector('input[type="file"]');
    const files = [0, 1, 2].map(
      (index) => new File(['x'], `file-${String(index)}.png`, { type: 'image/png' }),
    );

    await userEvent.upload(input as HTMLInputElement, files);
    release();

    await waitFor(() => expect(screen.getByLabelText('Remove file-0.png')).toBeInTheDocument());
    expect(screen.getByLabelText('Remove file-1.png')).toBeInTheDocument();
    expect(screen.getByLabelText('Remove file-2.png')).toBeInTheDocument();
  });
});
