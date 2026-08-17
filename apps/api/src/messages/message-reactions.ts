import { BadRequestException } from '@nestjs/common';

import { REACTION_EMOJI_MAX_LENGTH, type MessageReaction } from '@nestcord/shared';

import { PrismaService } from '../common/prisma/prisma.service';
import { groupReactions } from './message-response';

/**
 * The grouped reactions on a message, from one viewer's point of view.
 *
 * Shared by channel messages and DMs: who is allowed to react differs completely
 * between the two, but what a reaction list *is* does not, so the read lives here
 * rather than once in each service.
 */
export async function reactionsOf(
  prisma: PrismaService,
  messageId: string,
  viewerId: string,
): Promise<MessageReaction[]> {
  const rows = await prisma.client.reaction.findMany({
    where: { messageId },
    select: { emoji: true, userId: true },
    orderBy: { createdAt: 'asc' },
  });

  return groupReactions(rows, viewerId);
}

/**
 * A path parameter gets no DTO validation, so the one rule an emoji has is applied
 * here: short enough to be an emoji rather than a paragraph used as a label.
 */
export function requireEmoji(emoji: string): string {
  const trimmed = emoji.trim();

  if (!trimmed || [...trimmed].length > REACTION_EMOJI_MAX_LENGTH) {
    throw new BadRequestException('That is not an emoji');
  }

  return trimmed;
}
