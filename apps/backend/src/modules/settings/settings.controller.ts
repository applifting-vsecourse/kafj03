import { PrismaService } from '@/core/prisma/prisma.service';
import { Prisma, QuackMood } from '@/generated/prisma/client';
import { User } from '@/shared/auth/decorators/user.decorator';
import { Identity } from '@/shared/auth/domain/identity';
import { AuthenticatedUserGuard } from '@/shared/auth/guards/authenticated-user.guard';
import {
  Body,
  ConflictException,
  Controller,
  Patch,
  UseGuards,
  UsePipes,
  ValidationPipe,
} from '@nestjs/common';
import { Transform } from 'class-transformer';
import {
  IsEnum,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';

export class UpdateSettingsDto {
  @IsString()
  @MinLength(3)
  @MaxLength(30)
  @Matches(/^[a-zA-Z0-9._]+$/)
  username!: string;

  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  @IsString()
  @MinLength(1)
  name!: string;

  @IsString()
  @MaxLength(160)
  bio!: string;

  @IsOptional()
  @IsEnum(QuackMood)
  defaultMood!: QuackMood | null;
}

@Controller('settings')
@UseGuards(AuthenticatedUserGuard)
@UsePipes(
  new ValidationPipe({
    whitelist: true,
    forbidNonWhitelisted: true,
    transform: true,
  }),
)
export class SettingsController {
  constructor(private readonly prisma: PrismaService) {}

  @Patch()
  async update(
    @User() user: Identity,
    @Body() body: UpdateSettingsDto,
  ): Promise<{
    id: string;
    name: string;
    username: string | null;
    bio: string | null;
    defaultMood: QuackMood | null;
  }> {
    try {
      return await this.prisma.user.update({
        where: { id: user.id },
        data: {
          name: body.name,
          username: body.username,
          displayUsername: body.username,
          bio: body.bio,
          defaultMood: body.defaultMood ?? null,
        },
        select: {
          id: true,
          name: true,
          username: true,
          bio: true,
          defaultMood: true,
        },
      });
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        throw new ConflictException('This username is already taken');
      }
      throw error;
    }
  }
}
