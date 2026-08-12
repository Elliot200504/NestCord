import { createContext } from 'react';
import type { Socket } from 'socket.io-client';

/** A live handle on the app's socket, or null before it connects. */
export type SocketHandle = { current: Socket | null };

/**
 * The app's socket, behind a stable handle.
 *
 * A handle rather than the socket itself so connecting does not re-render every
 * consumer: nothing reads it during render, only inside callbacks that fire after the
 * connection exists. It is a context rather than a module singleton so a test can
 * supply a fake socket, and so nothing outside the provider can reach the connection.
 */
export const RealtimeContext = createContext<SocketHandle | null>(null);
