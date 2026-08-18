import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import type { VoiceParticipant } from '@nestcord/shared';

import { VoiceParticipants } from './VoiceParticipants';

function participant(overrides: Partial<VoiceParticipant> = {}): VoiceParticipant {
  return {
    serverId: 'server-1',
    channelId: 'channel-voice',
    user: {
      id: 'user-ada',
      username: 'ada',
      displayName: 'Ada Lovelace',
      avatarUrl: null,
      accentColor: null,
      status: 'ONLINE',
    },
    selfMute: false,
    selfDeaf: false,
    canSpeak: true,
    ...overrides,
  };
}

describe('VoiceParticipants', () => {
  it('renders nobody for an empty channel', () => {
    const { container } = render(<VoiceParticipants participants={[]} />);

    expect(container).toBeEmptyDOMElement();
  });

  it('names everyone in the call', () => {
    render(
      <VoiceParticipants
        participants={[
          participant(),
          participant({
            user: {
              id: 'user-grace',
              username: 'grace',
              displayName: null,
              avatarUrl: null,
              accentColor: null,
              status: 'ONLINE',
            },
          }),
        ]}
      />,
    );

    expect(screen.getByText('Ada Lovelace')).toBeInTheDocument();
    // No display name set, so the username stands in.
    expect(screen.getByText('grace')).toBeInTheDocument();
  });

  it('marks someone who muted themselves', () => {
    render(<VoiceParticipants participants={[participant({ selfMute: true })]} />);

    expect(screen.getByLabelText('Muted')).toBeInTheDocument();
  });

  it('shows a deafened person as deafened rather than merely muted', () => {
    render(<VoiceParticipants participants={[participant({ selfMute: true, selfDeaf: true })]} />);

    expect(screen.getByLabelText('Deafened')).toBeInTheDocument();
    expect(screen.queryByLabelText('Muted')).not.toBeInTheDocument();
  });
});
