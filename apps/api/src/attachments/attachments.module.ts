import { Module } from '@nestjs/common';

import { PermissionsModule } from '../common/permissions/permissions.module';
import { AttachmentStorage } from './attachment.storage';
import { AttachmentsController } from './attachments.controller';
import { AttachmentsService } from './attachments.service';

@Module({
  imports: [PermissionsModule],
  controllers: [AttachmentsController],
  providers: [AttachmentsService, AttachmentStorage],
  exports: [AttachmentsService],
})
export class AttachmentsModule {}
