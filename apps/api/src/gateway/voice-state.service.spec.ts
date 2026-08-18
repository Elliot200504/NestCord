import { MAX_VOICE_PARTICIPANTS, type PublicUser } from '@nestcord/shared';
import { beforeEach, describe, expect, it } from 'vitest';

import { VoiceStateService } from './voice-state.service';

const SERVER = 'server-1';
const GENERAL = 'channel-general-voice';
const GAMING = 'channel-gaming-voice';

function user(id: string): PublicUser {
  return {
    id,
    username: id,
    displayName: null,
    avatarUrl: null,
    accentColor: null,
    status: 'ONLINE',
  };
}

/** Fills a channel with distinct users, one socket each. */
function fill(voice: VoiceStateService, channelId: string, count: number): void {
  for (let index = 0; index < count; index += 1) {
    voice.join({
      serverId: SERVER,
      channelId,
      socketId: `socket-${index}`,
      user: user(`user-${index}`),
      canSpeak: true,
    });
  }
}

describe('VoiceStateService', () => {
  let voice: VoiceStateService;

  beforeEach(() => {
    voice = new VoiceStateService();
  });

  it('reports an empty channel as having nobody in it', () => {
    expect(voice.participantsIn(GENERAL)).toEqual([]);
  });

  it('accepts the last participant the cap allows', () => {
    fill(voice, GENERAL, MAX_VOICE_PARTICIPANTS - 1);

    const result = voice.join({
      serverId: SERVER,
      channelId: GENERAL,
      socketId: 'socket-last',
      user: user('user-last'),
      canSpeak: true,
    });

    expect(result).toEqual({ ok: true });
    expect(voice.countIn(GENERAL)).toBe(MAX_VOICE_PARTICIPANTS);
  });

  it('refuses one more than the cap', () => {
    fill(voice, GENERAL, MAX_VOICE_PARTICIPANTS);

    const result = voice.join({
      serverId: SERVER,
      channelId: GENERAL,
      socketId: 'socket-extra',
      user: user('user-extra'),
      canSpeak: true,
    });

    expect(result).toEqual({ ok: false, reason: 'full' });
    expect(voice.countIn(GENERAL)).toBe(MAX_VOICE_PARTICIPANTS);
  });

  it('lets a reconnecting tab rejoin a full channel without taking a second seat', () => {
    fill(voice, GENERAL, MAX_VOICE_PARTICIPANTS);

    const result = voice.join({
      serverId: SERVER,
      channelId: GENERAL,
      socketId: 'socket-reconnected',
      user: user('user-0'),
      canSpeak: true,
    });

    expect(result).toEqual({ ok: true });
    expect(voice.countIn(GENERAL)).toBe(MAX_VOICE_PARTICIPANTS);
    expect(voice.socketIdOf(GENERAL, 'user-0')).toBe('socket-reconnected');
  });

  it('forgets the socket a reconnecting tab replaced', () => {
    voice.join({ serverId: SERVER, channelId: GENERAL, socketId: 'socket-old', user: user('ada'), canSpeak: true });
    voice.join({ serverId: SERVER, channelId: GENERAL, socketId: 'socket-new', user: user('ada'), canSpeak: true });

    expect(voice.locationOf('socket-old')).toBeNull();
    expect(voice.leaveSocket('socket-old')).toBeNull();
    expect(voice.isIn(GENERAL, 'ada')).toBe(true);
  });

  it('moves a user out of their previous channel when they join another', () => {
    voice.join({ serverId: SERVER, channelId: GENERAL, socketId: 'socket-1', user: user('ada'), canSpeak: true });
    voice.leaveUser('ada');
    voice.join({ serverId: SERVER, channelId: GAMING, socketId: 'socket-1', user: user('ada'), canSpeak: true });

    expect(voice.isIn(GENERAL, 'ada')).toBe(false);
    expect(voice.isIn(GAMING, 'ada')).toBe(true);
  });

  it('removes the call a disconnected socket was carrying', () => {
    voice.join({ serverId: SERVER, channelId: GENERAL, socketId: 'socket-1', user: user('ada'), canSpeak: true });

    expect(voice.leaveSocket('socket-1')).toEqual({
      serverId: SERVER,
      channelId: GENERAL,
      userId: 'ada',
    });
    expect(voice.participantsIn(GENERAL)).toEqual([]);
  });

  it('frees a seat when someone disconnects from a full channel', () => {
    fill(voice, GENERAL, MAX_VOICE_PARTICIPANTS);
    voice.leaveSocket('socket-0');

    const result = voice.join({
      serverId: SERVER,
      channelId: GENERAL,
      socketId: 'socket-new',
      user: user('user-new'),
      canSpeak: true,
    });

    expect(result).toEqual({ ok: true });
  });

  it('records a mute and a deafen', () => {
    voice.join({ serverId: SERVER, channelId: GENERAL, socketId: 'socket-1', user: user('ada'), canSpeak: true });

    const updated = voice.update('socket-1', { selfMute: true, selfDeaf: true });

    expect(updated).toMatchObject({ channelId: GENERAL, selfMute: true, selfDeaf: true });
    expect(voice.participantsIn(GENERAL)[0]).toMatchObject({ selfMute: true, selfDeaf: true });
  });

  it('ignores an update from a socket that is not in a call', () => {
    expect(voice.update('socket-nowhere', { selfMute: true, selfDeaf: false })).toBeNull();
  });

  it('carries whether a participant may speak', () => {
    voice.join({ serverId: SERVER, channelId: GENERAL, socketId: 'socket-1', user: user('mute'), canSpeak: false });

    expect(voice.participantsIn(GENERAL)[0]).toMatchObject({ canSpeak: false });
  });

  it('names no socket for a user who is not in the channel', () => {
    expect(voice.socketIdOf(GENERAL, 'ada')).toBeNull();
  });
});
