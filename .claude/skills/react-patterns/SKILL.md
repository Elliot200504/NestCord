---
name: react-patterns
description: Concrete React + TanStack Query/Router + Zustand patterns for the NestCord web app — data hooks, optimistic updates, socket-to-cache wiring, component composition. Use when working under apps/web.
---

# React Patterns (NestCord web)

## When to activate

Adding a route, component, data hook, or store; wiring a realtime event into the UI.

## Query keys in one place

```ts
// api/keys.ts
export const keys = {
  me: ['me'] as const,
  servers: ['servers'] as const,
  server: (id: string) => ['servers', id] as const,
  channels: (serverId: string) => ['servers', serverId, 'channels'] as const,
  members: (serverId: string) => ['servers', serverId, 'members'] as const,
  messages: (channelId: string) => ['messages', channelId] as const,
  friends: ['friends'] as const,
  conversations: ['conversations'] as const,
};
```

Never inline a key string at a call site — that is how invalidation silently stops working.

## Data hooks live in features

```ts
// features/messages/use-messages.ts
export function useMessages(channelId: string) {
  return useInfiniteQuery({
    queryKey: keys.messages(channelId),
    queryFn: ({ pageParam }) => api.messages.list(channelId, { cursor: pageParam }),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (last) => last.nextCursor,
  });
}
```

## Optimistic mutations

Use them where latency is felt: sending a message, toggling a reaction.

```ts
export function useSendMessage(channelId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (content: string) => api.messages.create(channelId, { content }),
    onMutate: async (content) => {
      await qc.cancelQueries({ queryKey: keys.messages(channelId) });
      const previous = qc.getQueryData(keys.messages(channelId));
      qc.setQueryData(keys.messages(channelId), (old) => appendOptimistic(old, content));
      return { previous };
    },
    onError: (_err, _content, ctx) => {
      qc.setQueryData(keys.messages(channelId), ctx?.previous);
    },
    onSettled: () => qc.invalidateQueries({ queryKey: keys.messages(channelId) }),
  });
}
```

## Socket events feed the cache

One module owns this wiring:

```ts
// websocket/bind-events.ts
socket.on('message:create', (message) => {
  queryClient.setQueryData(keys.messages(message.channelId), (old) => prepend(old, message));
});
socket.on('message:delete', ({ channelId, messageId }) => {
  queryClient.setQueryData(keys.messages(channelId), (old) => removeById(old, messageId));
});
socket.on('member:join', ({ serverId }) => {
  queryClient.invalidateQueries({ queryKey: keys.members(serverId) });
});
```

`setQueryData` for high-frequency events (messages), `invalidateQueries` for rare ones (membership).

## Zustand for UI only

```ts
export const useUiStore = create<UiState>((set) => ({
  memberListOpen: true,
  activeModal: null,
  toggleMemberList: () => set((s) => ({ memberListOpen: !s.memberListOpen })),
  openModal: (modal) => set({ activeModal: modal }),
}));
```

No API data, no async fetching, no derived-from-route values.

## Protected routes

```ts
export const Route = createFileRoute('/app')({
  beforeLoad: ({ context, location }) => {
    if (!context.auth.isAuthenticated) {
      throw redirect({ to: '/login', search: { redirect: location.href } });
    }
  },
});
```

Auth decisions belong in the route tree, not inside components.

## Component composition

```text
MessageList          scroll container, pagination trigger
  MessageGroup       consecutive messages from one author
    Message          hover actions, highlight state
      MessageAuthor / MessageTimestamp / MessageContent
      MessageAttachment / MessageReply / MessageReaction
MessageComposer      draft state, submit, typing emit
TypingIndicator
```

Each component does one thing and takes data as props. Fetching happens at the feature root.

## Loading and error states

Every query-backed surface renders three states. Prefer skeletons matching the final layout over
spinners so the UI does not jump.

## Accessibility

Radix primitives for dialogs, dropdowns, context menus, tooltips. Keyboard navigation and focus
trapping come free — do not hand-roll them.

## Anti-patterns

Server data mirrored into `useState` or Zustand; `useEffect` used to derive state; array index as key;
a socket listener registered inside a component without cleanup; memoizing everything by default.
