import { useQuery } from '@tanstack/react-query';
import type { VoiceParticipant } from '@nestcord/shared';

import { keys } from '@/api/keys';
import { voiceApi } from './api';

/**
 * Who is in the server's voice channels.
 *
 * Read once when a server opens, then patched by `voice:state` events rather than
 * refetched — a mute is a frequent event and re-reading the whole server for one would
 * be silly. Disabled for `@me`, which has no voice channels.
 */
export function useVoiceStates(serverId: string) {
  return useQuery({
    queryKey: keys.voiceStates(serverId),
    queryFn: () => voiceApi.states(serverId),
    enabled: serverId !== '@me',
  });
}

/** The people in one channel, from the server-wide list. */
export function participantsIn(
  states: VoiceParticipant[] | undefined,
  channelId: string,
): VoiceParticipant[] {
  return (states ?? []).filter((state) => state.channelId === channelId);
}
