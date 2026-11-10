import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsOptional, IsString } from 'class-validator';

export class SearchQuacksDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  q?: string;

  @ApiPropertyOptional({ enum: ['all', 'mine'] })
  @IsOptional()
  @IsIn(['all', 'mine'])
  scope?: 'all' | 'mine';
}
