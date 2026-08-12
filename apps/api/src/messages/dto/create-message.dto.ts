import { ApiPropertyOptional } from '@nestjs/swagger';
import { ArrayMaxSize, IsArray, IsOptional, IsString, IsUUID, Length } from 'class-validator';

import { MESSAGE_MAX_ATTACHMENTS, MESSAGE_MAX_LENGTH } from '@nestcord/shared';

/**
 * Content is optional because a message may be nothing but an attachment. The
 * service rejects the case where both are empty — one of the two has to be there,
 * which is a rule about the pair rather than about either field.
 */
export class CreateMessageDto {
  @ApiPropertyOptional({ maxLength: MESSAGE_MAX_LENGTH, example: 'hey @alice, see #general' })
  @IsOptional()
  @IsString()
  @Length(0, MESSAGE_MAX_LENGTH)
  content?: string;

  @ApiPropertyOptional({ format: 'uuid', description: 'The message this replies to' })
  @IsOptional()
  @IsUUID()
  replyToId?: string;

  @ApiPropertyOptional({
    type: [String],
    format: 'uuid',
    maxItems: MESSAGE_MAX_ATTACHMENTS,
    description: 'Ids returned by the attachment upload route',
  })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(MESSAGE_MAX_ATTACHMENTS)
  @IsUUID(undefined, { each: true })
  attachmentIds?: string[];
}
