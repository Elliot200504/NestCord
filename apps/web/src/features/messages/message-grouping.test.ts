import { describe, expect, it } from 'vitest';

import type { Message, PublicUser } from '@nestcord/shared';

import { groupMessages, GROUP_WINDOW_MS } from './message-grouping';

const ADA: PublicUser = {
  id: 'user-ada',
  username: 'ada',
  displayName: null,
  avatarUrl: null,
  accentColor: null,
  status: 'ONLINE',
};

const GRACE: PublicUser = { ...ADA, id: 'user-grace', username: 'grace' };

const START = new Date('2026-08-12T09:00:00Z').getTime();

function message(overrides: Partial<Message> & { at?: number } = {}): Message {
  const { at = 0, ...rest } = overrides;

  return {
    id: `message-${at}`,
    channelId: 'channel-1',
    author: ADA,
    content: 'hello',
    createdAt: new Date(START + at).toISOString(),
    editedAt: null,
    replyTo: null,
    attachments: [],
    reactions: [],
    ...rest,
  };
}

describe('groupMessages', () => {
  it('keeps one author’s consecutive messages together', () => {
    const groups = groupMessages([message({ at: 0 }), message({ at: 1000 })]);

    expect(groups).toHaveLength(1);
    expect(groups[0]?.messages).toHaveLength(2);
  });

  it('starts a new group when the author changes', () => {
    const groups = groupMessages([message({ at: 0 }), message({ at: 1000, author: GRACE })]);

    expect(groups.map((group) => group.author.username)).toEqual(['ada', 'grace']);
  });

  it('starts a new group once the time window has passed', () => {
    const groups = groupMessages([message({ at: 0 }), message({ at: GROUP_WINDOW_MS + 1 })]);

    expect(groups).toHaveLength(2);
  });

  it('keeps messages together right up to the edge of the window', () => {
    const groups = groupMessages([message({ at: 0 }), message({ at: GROUP_WINDOW_MS })]);

    expect(groups).toHaveLength(1);
  });

  it('gives a reply its own group so its quoted line reads correctly', () => {
    const groups = groupMessages([
      message({ at: 0 }),
      message({
        at: 1000,
        replyTo: { id: 'message-0', author: GRACE, content: 'a question' },
      }),
    ]);

    expect(groups).toHaveLength(2);
  });

  it('keys each group by its first message, not by the author', () => {
    const groups = groupMessages([message({ at: 0 }), message({ at: GROUP_WINDOW_MS + 1 })]);

    expect(groups.map((group) => group.id)).toEqual([
      'message-0',
      `message-${GROUP_WINDOW_MS + 1}`,
    ]);
  });
});
