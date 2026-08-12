import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import type { ServerMember } from '@nestcord/shared';

import { MessageContent } from './MessageContent';

const MEMBERS: ServerMember[] = [
  {
    user: {
      id: 'user-ada',
      username: 'ada',
      displayName: 'Ada L.',
      avatarUrl: null,
      accentColor: null,
      status: 'ONLINE',
    },
    nickname: null,
    joinedAt: '2026-08-01T00:00:00.000Z',
    roleIds: [],
  },
];

function draw(content: string) {
  return render(
    <MessageContent content={content} members={MEMBERS} channels={[]} serverId="server-1" />,
  );
}

describe('MessageContent', () => {
  it('renders a mention of a real member as their name here', () => {
    draw('hey @ada');

    expect(screen.getByText('@ada')).toBeInTheDocument();
  });

  it('matches a mention whatever its capitalisation', () => {
    draw('hey @Ada');

    expect(screen.getByText('@ada')).toBeInTheDocument();
  });

  it('prefers a nickname over the username', () => {
    render(
      <MessageContent
        content="hey @ada"
        members={[{ ...MEMBERS[0]!, nickname: 'Countess' }]}
        channels={[]}
        serverId="server-1"
      />,
    );

    expect(screen.getByText('@Countess')).toBeInTheDocument();
  });

  it('leaves a mention of nobody as plain text', () => {
    // It notified no one, so rendering it as a mention would be a lie.
    const { container } = draw('hey @nobody');

    // No element wraps the mention on its own, so it is part of the sentence.
    expect(screen.queryByText('@nobody')).toBeNull();
    expect(container.textContent).toBe('hey @nobody');
  });

  it('marks up @everyone even though it names no member', () => {
    draw('@everyone look');

    expect(screen.getByText('@everyone')).toBeInTheDocument();
  });

  it('leaves a mention of a channel the reader cannot see as plain text', () => {
    const { container } = draw('see #secret');

    expect(container.querySelector('a')).toBeNull();
    expect(container.textContent).toBe('see #secret');
  });
});
