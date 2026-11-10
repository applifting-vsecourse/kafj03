import { QUACK_MOODS, QuackMood } from '@/modules/quack/domain/quack';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
  IsIn,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
  ValidateIf,
  ValidateNested,
} from 'class-validator';
import { CreatePollDto } from './create-poll.dto';

export class CreateQuackDto {
  @ApiProperty({
    description: 'Body of the quack',
    example: 'Hello, world!',
    maxLength: 280,
  })
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  @IsString()
  @IsNotEmpty()
  @MaxLength(280)
  text!: string;

  @ApiPropertyOptional()
  @ValidateIf((_object, value: unknown) => value !== undefined)
  @IsString()
  @IsNotEmpty()
  parentId?: string;

  @ApiPropertyOptional({ type: CreatePollDto })
  @ValidateIf((_object, value: unknown) => value !== undefined)
  @ValidateNested()
  @Type(() => CreatePollDto)
  poll?: CreatePollDto;

  @ApiPropertyOptional({ enum: QUACK_MOODS, nullable: true })
  @IsOptional()
  @IsIn(QUACK_MOODS)
  mood?: QuackMood | null;
}
