import { type APIRequestContext, test as setup } from '@playwright/test';

import type { AuthSession, Channel, Friend, Message, Paginated, Server } from '@nestcord/shared';

import { TEST_ACCOUNT, WORLD } from './world';

/**
 * Builds what the journeys need, over the API, before any of them run.
 *
 * The seed creates one account and nothing else, so the alternative was specs that
 * fail on a fresh database, or a seed that manufactures a fake world and deletes
 * yours to do it. Building it here means the setup goes through the same routes a
 * person's clicks do — a server that the API would not accept cannot be created for
 * a test to pass against.
 *
 * Everything below is "create it if it is missing". Registration is rate limited to
 * five an hour and login to ten a minute, so a fixture that made fresh accounts every
 * run would lock the suite out of its own API by the third run. Since `db:seed` no
 * longer wipes anything, the world it builds survives, and later runs spend one login
 * confirming it is still there.
 */

/** Signed in as somebody: the bearer token, and who it belongs to. */
type Session = { readonly token: string; readonly userId: string };

const HELPER_PASSWORD = TEST_ACCOUNT.password;

/** Enough history that the channel journeys are not looking at an empty channel. */
const OPENING_MESSAGES = [
  'This channel is built by the Playwright setup before the journeys run.',
  'Anything below this line was sent by a test.',
];

/** How long to wait for the API to come up, and how often to ask. */
const API_READY_TIMEOUT_MS = 120_000;
const API_POLL_INTERVAL_MS = 500;

/**
 * Waits until the API answers and can reach the database.
 *
 * Playwright's `webServer` waits for Vite, which is ready well before Nest has
 * finished booting and connecting to PostgreSQL. On a cold start — CI, or the
 * first local run of the day — the first request below would otherwise be
 * proxied to a port nothing is listening on yet, and a connection refused looks
 * exactly like a rejected login: "could not sign in, try `pnpm db:seed`", with
 * a perfectly good seeded account sitting in the database.
 *
 * `/api/health` is public and checks the database too, so a pass here means the
 * whole stack is genuinely ready rather than just listening.
 */
async function waitForApi(request: APIRequestContext): Promise<void> {
  const deadline = Date.now() + API_READY_TIMEOUT_MS;
  let detail = 'no response yet';

  while (Date.now() < deadline) {
    try {
      const response = await request.get('/api/health');

      if (response.ok()) {
        const body = (await response.json()) as { status: string; database: string };

        if (body.status === 'ok') return;

        detail = `status "${body.status}", database "${body.database}"`;
      } else {
        detail = `HTTP ${response.status()}`;
      }
    } catch (cause) {
      detail = cause instanceof Error ? cause.message : String(cause);
    }

    await new Promise((resolve) => setTimeout(resolve, API_POLL_INTERVAL_MS));
  }

  throw new Error(
    `The API did not become ready within ${String(API_READY_TIMEOUT_MS / 1000)}s. ` +
      `Last attempt: ${detail}.`,
  );
}

function authHeader(session: Session): Record<string, string> {
  return { Authorization: `Bearer ${session.token}` };
}

/** Throws with the status and the body, so a failed setup says what the API refused. */
async function readJson<T>(
  request: APIRequestContext,
  method: 'get' | 'post',
  path: string,
  session: Session | null,
  data?: unknown,
): Promise<T> {
  const response = await request[method](path, {
    ...(session ? { headers: authHeader(session) } : {}),
    ...(data === undefined ? {} : { data }),
  });

  if (!response.ok()) {
    throw new Error(
      `${method.toUpperCase()} ${path} failed (HTTP ${response.status()}): ${await response.text()}`,
    );
  }

  return (await response.json()) as T;
}

async function signInAs(
  request: APIRequestContext,
  email: string,
  password: string,
): Promise<Session | null> {
  const response = await request.post('/api/auth/login', { data: { email, password } });
  if (!response.ok()) return null;

  const session = (await response.json()) as AuthSession;
  return { token: session.accessToken, userId: session.user.id };
}

/** The seeded account. Its absence is a missing `pnpm db:seed`, not a bug. */
async function signInAsOwner(request: APIRequestContext): Promise<Session> {
  const session = await signInAs(request, TEST_ACCOUNT.email, TEST_ACCOUNT.password);

  if (!session) {
    throw new Error(
      `Could not sign in as ${TEST_ACCOUNT.email}. Run \`pnpm db:seed\` to create the account.`,
    );
  }

  return session;
}

/**
 * The extra people the friends page needs. Registered once per database and reused
 * from then on, which is what keeps this inside the registration rate limit.
 */
async function ensureAccount(request: APIRequestContext, username: string): Promise<Session> {
  const email = `${username}@nestcord.local`;

  const existing = await signInAs(request, email, HELPER_PASSWORD);
  if (existing) return existing;

  const created = await readJson<AuthSession>(request, 'post', '/api/auth/register', null, {
    username,
    email,
    password: HELPER_PASSWORD,
  });

  return { token: created.accessToken, userId: created.user.id };
}

async function ensureServer(request: APIRequestContext, owner: Session): Promise<Server> {
  const servers = await readJson<Server[]>(request, 'get', '/api/servers', owner);
  const existing = servers.find((server) => server.name === WORLD.server);
  if (existing) return existing;

  return readJson<Server>(request, 'post', '/api/servers', owner, { name: WORLD.server });
}

async function ensureChannels(
  request: APIRequestContext,
  owner: Session,
  serverId: string,
): Promise<Channel> {
  const path = `/api/servers/${serverId}/channels`;
  const channels = await readJson<Channel[]>(request, 'get', path, owner);

  if (!channels.some((channel) => channel.name === WORLD.otherChannel)) {
    await readJson<Channel>(request, 'post', path, owner, {
      name: WORLD.otherChannel,
      type: 'TEXT',
    });
  }

  // Creating a server creates this one, so it should always be here already.
  const general = channels.find((channel) => channel.name === WORLD.channel);
  if (!general) {
    throw new Error(`The "${WORLD.server}" server has no #${WORLD.channel} channel.`);
  }

  return general;
}

async function ensureHistory(
  request: APIRequestContext,
  owner: Session,
  serverId: string,
  channelId: string,
): Promise<void> {
  const path = `/api/servers/${serverId}/channels/${channelId}/messages`;
  const history = await readJson<Paginated<Message>>(request, 'get', path, owner);
  if (history.items.length > 0) return;

  for (const content of OPENING_MESSAGES) {
    await readJson<Message>(request, 'post', path, owner, { content });
  }
}

/**
 * One accepted friend and one request still waiting, which is what the friends page
 * journey walks through. A friendship in some other state — blocked, or pointing the
 * wrong way — is left alone and reported, because guessing at a repair could delete a
 * row somebody put there on purpose.
 */
async function ensureFriends(request: APIRequestContext, owner: Session): Promise<void> {
  const friends = await readJson<Friend[]>(request, 'get', '/api/friends', owner);
  const rowFor = (username: string) => friends.find((row) => row.user.username === username);

  const accepted = rowFor(WORLD.friend);
  if (!accepted) {
    const friend = await ensureAccount(request, WORLD.friend);
    await readJson<Friend>(request, 'post', '/api/friends', friend, {
      username: TEST_ACCOUNT.username,
    });
    await readJson<Friend>(request, 'post', `/api/friends/${friend.userId}/accept`, owner);
  } else if (accepted.status !== 'ACCEPTED') {
    throw new Error(
      `${WORLD.friend} should be an accepted friend but is ${accepted.status}. ` +
        'Remove the friendship and re-run.',
    );
  }

  const waiting = rowFor(WORLD.requester);
  if (!waiting) {
    const requester = await ensureAccount(request, WORLD.requester);
    await readJson<Friend>(request, 'post', '/api/friends', requester, {
      username: TEST_ACCOUNT.username,
    });
  } else if (waiting.status !== 'PENDING' || waiting.direction !== 'INCOMING') {
    throw new Error(
      `${WORLD.requester} should have a request waiting on ${TEST_ACCOUNT.username} but is ` +
        `${waiting.status}/${waiting.direction}. Remove the friendship and re-run.`,
    );
  }
}

setup('builds the world the journeys need', async ({ request }) => {
  // Covers the cold start: building two packages and booting Nest takes longer
  // than a test is normally allowed.
  setup.setTimeout(API_READY_TIMEOUT_MS + 60_000);

  await waitForApi(request);

  const owner = await signInAsOwner(request);

  const server = await ensureServer(request, owner);
  const general = await ensureChannels(request, owner, server.id);
  await ensureHistory(request, owner, server.id, general.id);

  await ensureFriends(request, owner);
});
