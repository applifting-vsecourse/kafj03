import { IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class RepliesQueryDto {
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  cursor?: string;

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  target?: string;
}
