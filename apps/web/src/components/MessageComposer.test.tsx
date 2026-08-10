import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { MessageComposer } from './MessageComposer';

describe('MessageComposer', () => {
  it('sends the draft on Enter and clears the input', async () => {
    const user = userEvent.setup();
    const onSend = vi.fn();
    render(<MessageComposer channelName="general" onSend={onSend} />);

    const input = screen.getByRole('textbox', { name: 'Message #general' });
    await user.type(input, 'hello there{Enter}');

    expect(onSend).toHaveBeenCalledExactlyOnceWith('hello there');
    expect(input).toHaveValue('');
  });

  it('inserts a newline on Shift+Enter instead of sending', async () => {
    const user = userEvent.setup();
    const onSend = vi.fn();
    render(<MessageComposer channelName="general" onSend={onSend} />);

    const input = screen.getByRole('textbox', { name: 'Message #general' });
    await user.type(input, 'first{Shift>}{Enter}{/Shift}second');

    expect(onSend).not.toHaveBeenCalled();
    expect(input).toHaveValue('first\nsecond');
  });

  it('does not send a whitespace-only draft', async () => {
    const user = userEvent.setup();
    const onSend = vi.fn();
    render(<MessageComposer channelName="general" onSend={onSend} />);

    await user.type(screen.getByRole('textbox', { name: 'Message #general' }), '   {Enter}');

    expect(onSend).not.toHaveBeenCalled();
    expect(screen.getByRole('button', { name: 'Send message' })).toBeDisabled();
  });
});
