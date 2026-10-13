import { PollRepository } from '@/modules/quack/repositories/poll.repository';
import { PollEventsService } from '@/modules/quack/services/poll-events.service';
import { User } from '@/shared/auth/decorators/user.decorator';
import { Identity } from '@/shared/auth/domain/identity';
import { AuthenticatedUserGuard } from '@/shared/auth/guards/authenticated-user.guard';
import {
  Body,
  Controller,
  Header,
  MessageEvent,
  Param,
  Put,
  Sse,
  UseGuards,
  UsePipes,
  ValidationPipe,
} from '@nestjs/common';
import {
  ApiCookieAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { Observable } from 'rxjs';
import { PollResponseDto } from './dto/poll.response.dto';
import { VoteDto } from './dto/vote.dto';

@ApiTags('quacks')
@ApiCookieAuth()
@Controller('quacks')
@UseGuards(AuthenticatedUserGuard)
@UsePipes(
  new ValidationPipe({
    whitelist: true,
    forbidNonWhitelisted: true,
    transform: true,
  }),
)
export class PollsController {
  constructor(
    private readonly polls: PollRepository,
    private readonly pollEvents: PollEventsService,
  ) {}

  @Sse('polls/events')
  @Header('X-Accel-Buffering', 'no')
  @ApiOperation({ summary: 'Subscribe to committed poll changes' })
  events(): Observable<MessageEvent> {
    return this.pollEvents.events();
  }

  @Put(':id/poll/vote')
  @ApiOperation({ summary: 'Create or change your vote' })
  @ApiResponse({ status: 200, type: PollResponseDto })
  @ApiResponse({ status: 400, description: 'Invalid option' })
  @ApiResponse({ status: 401, description: 'Not signed in' })
  @ApiResponse({ status: 404, description: 'Poll not found' })
  vote(
    @Param('id') quackId: string,
    @User() user: Identity,
    @Body() body: VoteDto,
  ): Promise<PollResponseDto> {
    // All quacks are currently accessible to every authenticated user.
    return this.polls.vote(quackId, user.id, body.optionId);
  }
}
