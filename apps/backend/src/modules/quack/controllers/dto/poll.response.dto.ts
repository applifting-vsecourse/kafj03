import { PollResult } from '@/modules/quack/domain/poll';
import { ApiProperty } from '@nestjs/swagger';

class PollOptionResponseDto {
  @ApiProperty() id!: string;
  @ApiProperty() text!: string;
  @ApiProperty() position!: number;
  @ApiProperty() votes!: number;
  @ApiProperty() percentage!: number;
}

export class PollResponseDto implements PollResult {
  @ApiProperty() id!: string;
  @ApiProperty() question!: string;
  @ApiProperty() revision!: number;
  @ApiProperty() totalVotes!: number;
  @ApiProperty({ type: String, nullable: true }) myOptionId!: string | null;
  @ApiProperty({ type: [PollOptionResponseDto] })
  options!: PollOptionResponseDto[];
}
