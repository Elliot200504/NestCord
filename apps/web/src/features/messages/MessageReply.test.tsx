import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import type { MessageReference } from '@nestcord/shared';

import { MessageReply } from './MessageReply';

function reference(overrides: Partial<MessageReference> = {}): MessageReference {
  return {
    id: 'message-1',
    author: {
      id: 'user-grace',
      username: 'grace',
      displayName: 'Grace H.',
      avatarUrl: null,
      accentColor: '#23a55a',
      status: 'ONLINE',
    },
    content: 'did anyone look at the deploy',
    ...overrides,
  };
}

describe('MessageReply', () => {
  it('shows who is being answered and what they said', () => {
    render(<MessageReply replyTo={reference()} />);

    expect(screen.getByText('Grace H.')).toBeInTheDocument();
    expect(screen.getByText('did anyone look at the deploy')).toBeInTheDocument();
  });

  it('puts the name above the quoted text rather than beside it', () => {
    render(<MessageReply replyTo={reference()} />);

    const name = screen.getByText('Grace H.');
    const quoted = screen.getByText('did anyone look at the deploy');

    // Separate lines, so neither is a child of the other.
    expect(name.closest('p')).not.toBe(quoted.closest('p'));
  });

  it('colours the name apart from the quoted text', () => {
    render(<MessageReply replyTo={reference()} />);

    expect(screen.getByText('Grace H.')).toHaveStyle({ color: '#23a55a' });
  });

  it('keeps the small avatar to one circle at its own size', () => {
    const { container } = render(<MessageReply replyTo={reference()} />);

    // The regression this guards: the size class went on the wrapper while the
    // circle inside kept a larger one, so it overflowed into the name beside it.
    const circle = container.querySelector('span > span[aria-hidden]');

    expect(circle?.className).toContain('size-4');
    expect(circle?.className).toContain('rounded-full');
  });

  it('says an attachment was sent when there were no words', () => {
    render(<MessageReply replyTo={reference({ content: '' })} />);

    expect(screen.getByText('sent an attachment')).toBeInTheDocument();
  });
});
