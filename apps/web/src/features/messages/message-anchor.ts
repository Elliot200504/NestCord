/**
 * Where a message lives in the DOM, so a reply quote can scroll to the message it
 * answers. Its own module because `Message.tsx` exports a component, and a function
 * alongside it breaks fast refresh for the whole file.
 */
export function messageAnchorId(messageId: string): string {
  return `message-${messageId}`;
}
