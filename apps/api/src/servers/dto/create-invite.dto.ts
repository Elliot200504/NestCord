import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsInt, IsOptional, Max, Min } from 'class-validator';

/** A month is long enough for any invite a small community needs. */
export const INVITE_MAX_AGE_HOURS = 24 * 30;
export const INVITE_MAX_USES = 1000;

export class CreateInviteDto {
  @ApiPropertyOptional({
    minimum: 1,
    maximum: INVITE_MAX_AGE_HOURS,
    description: 'Hours until the invite expires. Omit for an invite that never expires.',
  })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(INVITE_MAX_AGE_HOURS)
  expiresInHours?: number;

  @ApiPropertyOptional({
    minimum: 1,
    maximum: INVITE_MAX_USES,
    description: 'How many people may use it. Omit for unlimited.',
  })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(INVITE_MAX_USES)
  maxUses?: number;
}
