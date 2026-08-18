import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import {
  DEFAULT_EVERYONE_PERMISSIONS,
  MAX_VOICE_PARTICIPANTS,
  Permission,
  type Channel,
  type VoiceParticipant,
} from '@nestcord/shared';

import { VoiceChannelButton } from './VoiceChannelButton';

const CHANNEL: Channel = {
  id: 'channel-voice',
  serverId: 'server-1',
  name: 'General Voice',
  type: 'VOICE',
  topic: null,
  position: 0,
  parentId: null,
  permissions: DEFAULT_EVERYONE_PERMISSIONS,
};

function participants(count: number): VoiceParticipant[] {
  return Array.from({ length: count }, (_unused, index) => ({
    serverId: CHANNEL.serverId,
    channelId: CHANNEL.id,
    user: {
      id: `user-${index}`,
      username: `user-${index}`,
      displayName: null,
      avatarUrl: null,
      accentColor: null,
      status: 'ONLINE' as const,
    },
    selfMute: false,
    selfDeaf: false,
    canSpeak: true,
  }));
}

function renderButton(props: Partial<Parameters<typeof VoiceChannelButton>[0]> = {}) {
  const onJoin = vi.fn();

  render(
    <VoiceChannelButton
      channel={CHANNEL}
      participants={[]}
      isActive={false}
      onJoin={onJoin}
      {...props}
    />,
  );

  return { onJoin, button: screen.getByRole('button', { name: /General Voice/ }) };
}

describe('VoiceChannelButton', () => {
  it('joins the channel when clicked', async () => {
    const { onJoin, button } = renderButton();

    button.click();

    expect(onJoin).toHaveBeenCalledOnce();
  });

  it('shows how full the channel is once anyone is in it', () => {
    renderButton({ participants: participants(3) });

    expect(screen.getByText(`3/${MAX_VOICE_PARTICIPANTS}`)).toBeInTheDocument();
  });

  it('says nothing about capacity for an empty channel', () => {
    renderButton();

    expect(screen.queryByText(`0/${MAX_VOICE_PARTICIPANTS}`)).not.toBeInTheDocument();
  });

  it('refuses a join once the channel is full, and says why', () => {
    const { onJoin, button } = renderButton({
      participants: participants(MAX_VOICE_PARTICIPANTS),
    });

    expect(button).toBeDisabled();
    expect(button).toHaveAttribute(
      'title',
      `This voice channel is full (${MAX_VOICE_PARTICIPANTS} of ${MAX_VOICE_PARTICIPANTS})`,
    );

    button.click();
    expect(onJoin).not.toHaveBeenCalled();
  });

  it('stays clickable when the full channel is the one you are already in', () => {
    const { button } = renderButton({
      participants: participants(MAX_VOICE_PARTICIPANTS),
      isActive: true,
    });

    expect(button).toBeEnabled();
  });

  it('refuses a join without CONNECT, and says why', () => {
    const { onJoin, button } = renderButton({
      channel: { ...CHANNEL, permissions: Permission.VIEW_CHANNEL },
    });

    expect(button).toBeDisabled();
    expect(button).toHaveAttribute(
      'title',
      'You do not have permission to join this voice channel',
    );

    button.click();
    expect(onJoin).not.toHaveBeenCalled();
  });
});
