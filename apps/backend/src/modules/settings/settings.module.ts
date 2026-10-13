import { PrismaModule } from '@/core/prisma/prisma.module';
import { AuthModule } from '@/shared/auth/auth.module';
import { Module } from '@nestjs/common';
import { SettingsController } from './settings.controller';

@Module({
  imports: [AuthModule, PrismaModule],
  controllers: [SettingsController],
})
export class SettingsModule {}
