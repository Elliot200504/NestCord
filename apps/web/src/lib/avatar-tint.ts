/**
 * A stable warm tint per name, so a wall of avatars reads as a group of people
 * instead of a column of identical grey circles. Every entry stays inside the
 * brand's warm range — reds, clay and amber, nothing that fights the palette.
 */
const TINTS = [
  'bg-nest-700/35 text-nest-400',
  'bg-idle/15 text-idle',
  'bg-nest-500/20 text-nest-400',
  'bg-surface-600 text-content-300',
  'bg-nest-600/25 text-nest-400',
] as const;

export function avatarTint(name: string): string {
  const sum = [...name].reduce((total, char) => total + char.charCodeAt(0), 0);

  return TINTS[sum % TINTS.length] ?? TINTS[0];
}
