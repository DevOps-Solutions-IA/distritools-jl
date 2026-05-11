import { Module } from '@nestjs/common';
import { AuthModule } from 'src/modules/auth/auth.module';
import { AdminOperationsController } from 'src/modules/admin-operations/infrastructure/http/controllers/admin-operations.controller';

@Module({
  imports: [AuthModule],
  controllers: [AdminOperationsController],
})
export class AdminOperationsModule {}
