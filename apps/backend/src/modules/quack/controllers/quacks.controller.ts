import { QuacksService } from '@/modules/quack/services/quacks.service';
import { User } from '@/shared/auth/decorators/user.decorator';
import { Identity } from '@/shared/auth/domain/identity';
import { AuthenticatedUserGuard } from '@/shared/auth/guards/authenticated-user.guard';
import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Query,
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
import { CreateQuackDto } from './dto/create-quack.dto';
import { QuackResponseDto } from './dto/quack.response.dto';
import { SearchQuacksDto } from './dto/search-quacks.dto';
import { SearchUsageDto } from './dto/search-usage.dto';

@ApiTags('quacks')
@Controller('quacks')
@UseGuards(AuthenticatedUserGuard)
@ApiCookieAuth()
@UsePipes(
  new ValidationPipe({
    whitelist: true,
    forbidNonWhitelisted: true,
    transform: true,
  }),
)
export class QuacksController {
  constructor(private readonly quacksService: QuacksService) {}

  @Get()
  @ApiOperation({ summary: 'List all quacks' })
  @ApiResponse({ status: 200, type: [QuackResponseDto] })
  @ApiResponse({ status: 401, description: 'Not signed in' })
  async list(
    @User() user: Identity,
    @Query() query: SearchQuacksDto = {},
  ): Promise<QuackResponseDto[]> {
    const quacks = await this.quacksService.getQuacks(query.q, user.id);
    return quacks.map(QuackResponseDto.fromDomain);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a quack' })
  @ApiResponse({ status: 200, type: QuackResponseDto })
  @ApiResponse({ status: 404, description: 'Post not found' })
  async detail(
    @Param('id') id: string,
    @User() user: Identity,
  ): Promise<QuackResponseDto> {
    return QuackResponseDto.fromDomain(
      await this.quacksService.getQuack(id, user),
    );
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete your own quack' })
  @ApiResponse({ status: 204, description: 'Post deleted' })
  @ApiResponse({ status: 403, description: 'Not the author' })
  @ApiResponse({ status: 404, description: 'Post not found' })
  async delete(@Param('id') id: string, @User() user: Identity): Promise<void> {
    await this.quacksService.deleteQuack(id, user);
  }

  @Post('usage')
  @HttpCode(HttpStatus.NO_CONTENT)
  async usage(
    @User() user: Identity,
    @Body() body: SearchUsageDto,
  ): Promise<void> {
    await this.quacksService.recordUsage(user, body.event);
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create a quack' })
  @ApiResponse({ status: 201, type: QuackResponseDto })
  @ApiResponse({ status: 401, description: 'Not signed in' })
  async create(
    @User() user: Identity,
    @Body() body: CreateQuackDto,
  ): Promise<QuackResponseDto> {
    const quack = await this.quacksService.createQuack(user, {
      text: body.text,
      mood: body.mood,
      ...(body.poll ? { poll: body.poll } : {}),
    });
    return QuackResponseDto.fromDomain(quack);
  }
}
