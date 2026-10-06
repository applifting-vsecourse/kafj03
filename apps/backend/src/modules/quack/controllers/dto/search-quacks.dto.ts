import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString } from 'class-validator';

export class SearchQuacksDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  q?: string;
}
