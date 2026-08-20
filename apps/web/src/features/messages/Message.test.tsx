import { useState } from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import type { Message, PublicUser } from '@nestcord/shared';

import { MessageRow } from './Message';

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
    channelId: 'channel-1',
    conversationId: null,
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

/** Stands in for `MessageList`'s shared reveal state and its click-outside close. */
function Harness({
  messages,
  onReply = vi.fn(),
}: {
  messages: Message[];
  onReply?: (message: Message) => void;
}) {
  const [revealedId, setRevealedId] = useState<string | null>(null);

  return (
    <div
      onClick={(event) => {
        if (!(event.target as HTMLElement).closest('[data-message-row]')) setRevealedId(null);
      }}
    >
      <p>the space around the messages</p>

      {messages.map((msg) => (
        <MessageRow
          key={msg.id}
          message={msg}
          serverId="server-1"
          members={[]}
          channels={[]}
          revealOnBlockHover={false}
          isFlashing={false}
          revealedId={revealedId}
          onReveal={setRevealedId}
          canReply
          canReact
          canEdit={false}
          canDelete={false}
          onReply={onReply}
          onReact={vi.fn()}
          onEdit={vi.fn()}
          onDelete={vi.fn()}
        />
      ))}
    </div>
  );
}

describe('the message toolbar on a device with no hover', () => {
  it('stays closed until the message is tapped', () => {
    render(<Harness messages={[message()]} />);

    expect(screen.queryByRole('button', { name: 'Reply' })).not.toBeInTheDocument();
  });

  it('opens on a tap and closes again on a second tap', async () => {
    const user = userEvent.setup();
    render(<Harness messages={[message()]} />);

    await user.click(screen.getByText('hello'));
    expect(screen.getByRole('button', { name: 'Reply' })).toBeInTheDocument();

    await user.click(screen.getByText('hello'));
    expect(screen.queryByRole('button', { name: 'Reply' })).not.toBeInTheDocument();
  });

  it('moves the reveal to whichever message was tapped last', async () => {
    const user = userEvent.setup();
    render(
      <Harness
        messages={[message({ id: 'a', content: 'first' }), message({ id: 'b', content: 'second' })]}
      />,
    );

    await user.click(screen.getByText('first'));
    expect(screen.getAllByRole('button', { name: 'Reply' })).toHaveLength(1);

    await user.click(screen.getByText('second'));
    expect(screen.getAllByRole('button', { name: 'Reply' })).toHaveLength(1);
  });

  it('closes when the reader taps elsewhere', async () => {
    const user = userEvent.setup();
    render(<Harness messages={[message()]} />);

    await user.click(screen.getByText('hello'));
    expect(screen.getByRole('button', { name: 'Reply' })).toBeInTheDocument();

    await user.click(screen.getByText('the space around the messages'));
    expect(screen.queryByRole('button', { name: 'Reply' })).not.toBeInTheDocument();
  });

  it('closes again once an action is taken', async () => {
    const onReply = vi.fn();
    const user = userEvent.setup();
    render(<Harness messages={[message()]} onReply={onReply} />);

    await user.click(screen.getByText('hello'));
    await user.click(screen.getByRole('button', { name: 'Reply' }));

    expect(onReply).toHaveBeenCalledOnce();
    expect(screen.queryByRole('button', { name: 'Reply' })).not.toBeInTheDocument();
  });
});
