import { ApiProperty } from '@nestjs/swagger';

import type {
  Message,
  MessageAttachment,
  MessageReaction,
  MessageReference,
} from '@nestcord/shared';

import { PublicUserDto } from '../../auth/dto/auth-session.dto';

/** Documents the shape of `MessageAttachment`; the type still comes from shared. */
export class MessageAttachmentDto implements MessageAttachment {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({ example: 'diagram.png', description: 'For display only — never a path' })
  filename!: string;

  @ApiProperty({ example: 'image/png' })
  mimeType!: string;

  @ApiProperty({ description: 'Bytes' })
  size!: number;

  @ApiProperty({ example: '/uploads/attachments/0f7c….png' })
  url!: string;
}

export class MessageReactionDto implements MessageReaction {
  @ApiProperty({ example: '👍' })
  emoji!: string;

  @ApiProperty()
  count!: number;

  @ApiProperty({ description: 'True when you are one of the reactors' })
  me!: boolean;
}

export class MessageReferenceDto implements MessageReference {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({ type: PublicUserDto })
  author!: PublicUserDto;

  @ApiProperty()
  content!: string;
}

export class MessageDto implements Message {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({ format: 'uuid' })
  channelId!: string;

  @ApiProperty({ type: PublicUserDto })
  author!: PublicUserDto;

  @ApiProperty({ description: 'Raw text — markdown and mentions resolve at render time' })
  content!: string;

  @ApiProperty({ format: 'date-time' })
  createdAt!: string;

  @ApiProperty({ format: 'date-time', nullable: true, type: String })
  editedAt!: string | null;

  @ApiProperty({
    type: MessageReferenceDto,
    nullable: true,
    description: 'Null when this is not a reply, or its target was deleted',
  })
  replyTo!: MessageReferenceDto | null;

  @ApiProperty({ type: [MessageAttachmentDto] })
  attachments!: MessageAttachmentDto[];

  @ApiProperty({ type: [MessageReactionDto] })
  reactions!: MessageReactionDto[];
}

/** One page of history, newest first. */
export class MessagePageDto {
  @ApiProperty({ type: [MessageDto] })
  items!: MessageDto[];

  @ApiProperty({
    nullable: true,
    type: String,
    description: 'Pass as `before` for the next page; null when the channel start is reached',
  })
  nextCursor!: string | null;
}
