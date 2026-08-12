import { describe, expect, it } from 'vitest';

import { cleanCategoryName, slugifyChannelName } from './channel-name.js';
import { CHANNEL_NAME_MAX_LENGTH } from './types.js';

describe('slugifyChannelName', () => {
  it('lowercases and hyphenates what someone typed', () => {
    expect(slugifyChannelName('General Chat')).toBe('general-chat');
  });

  it('collapses punctuation and runs of separators into single hyphens', () => {
    expect(slugifyChannelName('bugs & ideas!!  (2026)')).toBe('bugs-ideas-2026');
  });

  it('keeps letters from other alphabets', () => {
    expect(slugifyChannelName('Kaffepaus åäö')).toBe('kaffepaus-åäö');
  });

  it('trims leading and trailing separators', () => {
    expect(slugifyChannelName('  --hello--  ')).toBe('hello');
  });

  it('never ends on a hyphen left behind by the length cap', () => {
    const slug = slugifyChannelName(`${'a'.repeat(CHANNEL_NAME_MAX_LENGTH)} tail`);

    expect(slug).toHaveLength(CHANNEL_NAME_MAX_LENGTH);
    expect(slug.endsWith('-')).toBe(false);
  });

  it('returns an empty string when there is nothing to keep', () => {
    expect(slugifyChannelName('!!!')).toBe('');
  });
});

describe('cleanCategoryName', () => {
  it('keeps capitals and spaces', () => {
    expect(cleanCategoryName('Text Channels')).toBe('Text Channels');
  });

  it('collapses whitespace', () => {
    expect(cleanCategoryName('  Voice   rooms \n')).toBe('Voice rooms');
  });
});
