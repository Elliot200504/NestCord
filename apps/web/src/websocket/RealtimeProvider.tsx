import { useEffect, useRef, type ReactNode } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import type { Socket } from 'socket.io-client';

import { useCurrentUser } from '@/features/auth/use-auth';
import { useTypingStore } from '@/stores/typing-store';
import { RealtimeContext } from './realtime-context';
import { registerRealtimeListeners } from './realtime-listeners';
import { connectRealtime } from './socket';

/**
 * Holds the app's one socket open for as long as someone is signed in.
 *
 * Mounted inside the authenticated shell, so there is exactly one connection and
 * exactly one set of listeners. Signing out unmounts it, which disconnects — the
 * server then sees the last socket close and tells everyone you went offline.
 */
export function RealtimeProvider({ children }: { children: ReactNode }) {
  const { data: user } = useCurrentUser();
  const queryClient = useQueryClient();
  const viewerId = user?.id;
  // A ref, not state: consumers read it from callbacks, so connecting does not need
  // to re-render the whole shell.
  const handle = useRef<Socket | null>(null);

  useEffect(() => {
    if (!viewerId) return;

    const socket = connectRealtime();
    const unregister = registerRealtimeListeners(socket, queryClient, viewerId);
    handle.current = socket;

    return () => {
      handle.current = null;
      unregister();
      socket.disconnect();
      // Indicators belong to a live connection; leaving them up would strand someone
      // as forever typing.
      useTypingStore.getState().clear();
    };
  }, [viewerId, queryClient]);

  return <RealtimeContext.Provider value={handle}>{children}</RealtimeContext.Provider>;
}
