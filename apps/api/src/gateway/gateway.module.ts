import { Module } from '@nestjs/common';

import { AuthModule } from '../auth/auth.module';
import { PermissionsModule } from '../common/permissions/permissions.module';
import { EventsGateway } from './events.gateway';
import { PresenceService } from './presence.service';
import { RealtimeService } from './realtime.service';
import { SocketRooms } from './socket-rooms';
import { VoiceStateService } from './voice-state.service';

/**
 * Exports only what other modules need to *send* — the gateway itself stays private,
 * so nothing outside here can reach into connection handling. Feature modules import
 * this one, never the other way round, which is what keeps the dependency acyclic.
 */
@Module({
  imports: [AuthModule, PermissionsModule],
  providers: [EventsGateway, PresenceService, RealtimeService, SocketRooms, VoiceStateService],
  exports: [RealtimeService, PresenceService, VoiceStateService],
})
export class GatewayModule {}
