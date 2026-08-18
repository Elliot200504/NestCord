import { Module } from '@nestjs/common';

import { ErrorsModule } from '../common/errors/errors.module';
import { AdminController } from './admin.controller';
import { AdminGuard } from './admin.guard';
import { AdminService } from './admin.service';

/** Reads the log ErrorsModule writes. Nothing else in the app imports this. */
@Module({
  imports: [ErrorsModule],
  controllers: [AdminController],
  providers: [AdminService, AdminGuard],
})
export class AdminModule {}
