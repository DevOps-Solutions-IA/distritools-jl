import { PublicFooterService } from './application/public-footer.service';
import { PublicFooterController } from './infrastructure/http/controllers/public-footer.controller';
import { Module } from '@nestjs/common';
import { AuthModule } from 'src/modules/auth/auth.module';
import { AdminOperationsController } from 'src/modules/admin-operations/infrastructure/http/controllers/admin-operations.controller';

@Module({
  imports: [AuthModule],
  controllers: [AdminOperationsController, PublicFooterController],
  providers: [PublicFooterService],
})
export class AdminOperationsModule {}
