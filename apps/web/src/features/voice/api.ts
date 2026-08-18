import type { VoiceParticipant } from '@nestcord/shared';

import { apiRequest } from '@/api/client';

export const voiceApi = {
  /** Who is in each voice channel of this server that you can see. */
  states: (serverId: string) =>
    apiRequest<VoiceParticipant[]>(`/servers/${serverId}/channels/voice-states`),
};
