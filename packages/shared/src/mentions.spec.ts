import { describe, expect, it } from 'vitest';

import { mentionMatches, mentionedUsernames, mentionsEveryone, parseMentions } from './mentions.js';

describe('parseMentions', () => {
  it('finds a user mention and where it sits', () => {
    expect(parseMentions('hey @alice')).toEqual([
      { type: 'user', name: 'alice', start: 4, end: 10 },
    ]);
  });

  it('returns mentions in the order they appear, whatever their kind', () => {
    const kinds = parseMentions('@alice see #general then @bob').map((mention) => mention.type);

    expect(kinds).toEqual(['user', 'channel', 'user']);
  });

  it('treats @everyone as its own kind rather than a username', () => {
    expect(parseMentions('@everyone')).toEqual([{ type: 'everyone', name: '', start: 0, end: 9 }]);
  });

  it('recognises @everyone however it is capitalised', () => {
    expect(mentionsEveryone('@Everyone look')).toBe(true);
  });

  it('finds nothing in text with no sigils', () => {
    expect(parseMentions('no mentions in this sentence')).toEqual([]);
  });

  it('still matches the domain half of an email address', () => {
    // Nothing here can tell it apart from a mention. Resolving the name against
    // real usernames is what stops it rendering as a link.
    expect(parseMentions('mail me@example.com')).toEqual([
      { type: 'user', name: 'example.com', start: 7, end: 19 },
    ]);
  });
});

describe('mentionedUsernames', () => {
  it('lowercases and deduplicates', () => {
    expect(mentionedUsernames('@Alice @alice @bob')).toEqual(['alice', 'bob']);
  });

  it('leaves out @everyone', () => {
    expect(mentionedUsernames('@everyone and @alice')).toEqual(['alice']);
  });
});

describe('mentionMatches', () => {
  it('ignores case so @Alice reaches alice', () => {
    const [mention] = parseMentions('@Alice');

    expect(mention && mentionMatches(mention, 'alice')).toBe(true);
  });
});
