/** Hosts we consider safe to seed against. */
const LOCAL_HOSTS = ['localhost', '127.0.0.1', '::1', 'db', 'postgres'];

/**
 * The seed plants an account whose password is written down in the repository,
 * so refuse to run against anything that is not an obviously local development
 * database. NestCord only ever runs locally, so this guard should never fire —
 * it is here because a seed that can reach a real database always needs one.
 *
 * Lives here rather than in `prisma/seed.ts` so it can be tested: importing the
 * seed runs it, since that module calls `main()` on load.
 */
export function assertLocalDatabase(url: string, nodeEnv = process.env.NODE_ENV): void {
  if (nodeEnv === 'production') {
    throw new Error('Refusing to seed: NODE_ENV is production.');
  }

  let host: string;
  try {
    host = new URL(url).hostname;
  } catch {
    throw new Error('Refusing to seed: DATABASE_URL is missing or not a valid URL.');
  }

  if (!LOCAL_HOSTS.includes(host)) {
    throw new Error(
      `Refusing to seed: database host "${host}" is not local. ` +
        'The seed uses a publicly known password. Point DATABASE_URL at a local database.',
    );
  }
}
