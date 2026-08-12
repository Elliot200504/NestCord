import type { ReactNode } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { useCreateInvite, useCreateRole, useUpdateRole } from './use-servers';

const SERVER = 'server-1';

interface Call {
  path: string;
  method: string | undefined;
  body: Record<string, unknown>;
}

/** Records what each mutation actually puts on the wire. */
function stubApi(): Call[] {
  const calls: Call[] = [];

  vi.stubGlobal(
    'fetch',
    vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
      calls.push({
        path: String(input),
        method: init?.method,
        body: init?.body ? (JSON.parse(String(init.body)) as Record<string, unknown>) : {},
      });

      return Promise.resolve(
        new Response(JSON.stringify({ id: 'role-1' }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        }),
      );
    }),
  );

  return calls;
}

function wrapper({ children }: { children: ReactNode }) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });

  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('useUpdateRole', () => {
  /**
   * The API validates with `forbidNonWhitelisted`, so a field the DTO does not
   * declare is a 400 rather than something it quietly ignores. `roleId` identifies
   * the role in the path and must not be repeated in the body.
   */
  it('sends the role id in the path only, never in the body', async () => {
    const calls = stubApi();
    const { result } = renderHook(() => useUpdateRole(SERVER), { wrapper });

    result.current.mutate({ roleId: 'role-9', name: 'Greeter', permissions: 3 });

    await waitFor(() => expect(calls).toHaveLength(1));

    expect(calls[0]?.path).toBe(`/api/servers/${SERVER}/roles/role-9`);
    expect(calls[0]?.method).toBe('PATCH');
    expect(calls[0]?.body).toEqual({ name: 'Greeter', permissions: 3 });
    expect(calls[0]?.body).not.toHaveProperty('roleId');
  });

  it('leaves out fields the caller did not set', async () => {
    const calls = stubApi();
    const { result } = renderHook(() => useUpdateRole(SERVER), { wrapper });

    result.current.mutate({ roleId: 'role-9', permissions: 7 });

    await waitFor(() => expect(calls).toHaveLength(1));

    expect(calls[0]?.body).toEqual({ permissions: 7 });
  });
});

describe('useCreateRole', () => {
  it('posts only the role fields', async () => {
    const calls = stubApi();
    const { result } = renderHook(() => useCreateRole(SERVER), { wrapper });

    result.current.mutate({ name: 'New role' });

    await waitFor(() => expect(calls).toHaveLength(1));

    expect(calls[0]?.path).toBe(`/api/servers/${SERVER}/roles`);
    expect(calls[0]?.method).toBe('POST');
    expect(calls[0]?.body).toEqual({ name: 'New role' });
  });
});

describe('useCreateInvite', () => {
  it('posts an empty body for an invite with no limits', async () => {
    const calls = stubApi();
    const { result } = renderHook(() => useCreateInvite(SERVER), { wrapper });

    result.current.mutate({});

    await waitFor(() => expect(calls).toHaveLength(1));

    expect(calls[0]?.body).toEqual({});
  });

  it('passes the expiry through when one was chosen', async () => {
    const calls = stubApi();
    const { result } = renderHook(() => useCreateInvite(SERVER), { wrapper });

    result.current.mutate({ expiresInHours: 24 });

    await waitFor(() => expect(calls).toHaveLength(1));

    expect(calls[0]?.body).toEqual({ expiresInHours: 24 });
  });
});
