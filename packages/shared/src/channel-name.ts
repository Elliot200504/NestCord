import { CHANNEL_NAME_MAX_LENGTH } from './types.js';

/**
 * Turn what someone typed into a channel name.
 *
 * Text and voice channels are addressed as `#like-this`, so spaces and punctuation
 * become hyphens rather than being rejected — a name is not the place to argue with
 * someone about formatting. Categories keep their capitals and spaces, so they go
 * through `cleanCategoryName` instead.
 *
 * The API applies this before storing; the web client applies it while typing so the
 * name shown in the input is the name that gets saved.
 */
export function slugifyChannelName(input: string): string {
  return (
    input
      .toLowerCase()
      // Keep letters and digits from any alphabet — a Swedish or Greek channel name
      // should survive this.
      .replace(/[^\p{L}\p{N}]+/gu, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, CHANNEL_NAME_MAX_LENGTH)
      // Slicing can leave a trailing hyphen behind, so trim once more.
      .replace(/-+$/g, '')
  );
}

/** Categories are display text: collapse the whitespace and leave the rest alone. */
export function cleanCategoryName(input: string): string {
  return input.trim().replace(/\s+/g, ' ').slice(0, CHANNEL_NAME_MAX_LENGTH);
}
