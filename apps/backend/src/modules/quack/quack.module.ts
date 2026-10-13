import { PrismaModule } from '@/core/prisma/prisma.module';
import { AuthModule } from '@/shared/auth/auth.module';
import { Module } from '@nestjs/common';
import { PollsController } from './controllers/polls.controller';
import { QuacksController } from './controllers/quacks.controller';
import { PollRepository } from './repositories/poll.repository';
import { QuackRepository } from './repositories/quack.repository';
import { QuacksService } from './services/quacks.service';

@Module({
  imports: [AuthModule, PrismaModule],
  controllers: [QuacksController, PollsController],
  providers: [QuacksService, QuackRepository, PollRepository],
  exports: [QuacksService],
})
export class QuackModule {}
