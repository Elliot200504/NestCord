import { ApiProperty } from '@nestjs/swagger';
import { IsInt, Min } from 'class-validator';

/**
 * A channel override, as sent by the client. A flag in neither field is inherited
 * from the server-level permissions, which is the neutral state in the UI.
 *
 * No `@Max`: the flags are not contiguous, so the service masks unknown bits off
 * rather than guessing at a ceiling.
 */
export class SetOverrideDto {
  @ApiProperty({ minimum: 0, description: 'Bitfield granted in this channel' })
  @IsInt()
  @Min(0)
  allow!: number;

  @ApiProperty({ minimum: 0, description: 'Bitfield taken away in this channel' })
  @IsInt()
  @Min(0)
  deny!: number;
}
