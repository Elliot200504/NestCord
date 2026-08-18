import { IsBoolean, IsInt, IsOptional, IsString, IsUUID, MaxLength, Min } from 'class-validator';

import {
  MAX_ICE_CANDIDATE_LENGTH,
  MAX_SDP_LENGTH,
  type VoiceCandidateInput,
  type VoiceDescriptionInput,
  type VoiceJoinInput,
  type VoiceUpdateInput,
} from '@nestcord/shared';

/**
 * Voice socket payloads.
 *
 * The signalling ones matter more than most DTOs here: an SDP blob or an ICE
 * candidate is a string written by one browser and handed straight to another, so it
 * is bounded and type-checked before the server passes it on. The gateway never
 * parses the contents — it only decides who is allowed to send them to whom.
 */
export class VoiceJoinDto implements VoiceJoinInput {
  @IsUUID()
  channelId!: string;
}

export class VoiceUpdateDto implements VoiceUpdateInput {
  @IsUUID()
  channelId!: string;

  @IsBoolean()
  selfMute!: boolean;

  @IsBoolean()
  selfDeaf!: boolean;
}

export class VoiceDescriptionDto implements VoiceDescriptionInput {
  @IsUUID()
  channelId!: string;

  @IsUUID()
  targetUserId!: string;

  @IsString()
  @MaxLength(MAX_SDP_LENGTH)
  sdp!: string;
}

export class VoiceCandidateDto implements VoiceCandidateInput {
  @IsUUID()
  channelId!: string;

  @IsUUID()
  targetUserId!: string;

  @IsString()
  @MaxLength(MAX_ICE_CANDIDATE_LENGTH)
  candidate!: string;

  // Both are null on the end-of-candidates signal, which is a real thing a browser
  // sends rather than a malformed payload.
  @IsOptional()
  @IsString()
  @MaxLength(MAX_ICE_CANDIDATE_LENGTH)
  sdpMid!: string | null;

  @IsOptional()
  @IsInt()
  @Min(0)
  sdpMLineIndex!: number | null;
}
