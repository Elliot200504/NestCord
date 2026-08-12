import * as argon2 from 'argon2';

/** Argon2id with defaults strong enough for a small app, tuned to stay under ~100ms. */
const HASH_OPTIONS = {
  type: argon2.argon2id,
  memoryCost: 19_456,
  timeCost: 2,
  parallelism: 1,
} as const satisfies argon2.HashOptions;

/**
 * The one place a password becomes a hash. Registration, login's timing-equaliser
 * and the change-password route all go through here, so they cannot drift onto
 * different parameters.
 */
export function hashPassword(plaintext: string): Promise<string> {
  return argon2.hash(plaintext, HASH_OPTIONS);
}

export function verifyPassword(hash: string, plaintext: string): Promise<boolean> {
  return argon2.verify(hash, plaintext);
}
