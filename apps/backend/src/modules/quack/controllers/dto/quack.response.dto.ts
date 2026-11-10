import { Quack, QUACK_MOODS, QuackMood } from '@/modules/quack/domain/quack';
import { ApiProperty } from '@nestjs/swagger';
import { PollResponseDto } from './poll.response.dto';

class QuackUserDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  name!: string;

  @ApiProperty()
  username!: string;
}

export class QuackResponseDto {
  @ApiProperty()
  id!: string;

  @ApiProperty({ type: String, nullable: true })
  text!: string | null;

  @ApiProperty({ enum: QUACK_MOODS, nullable: true })
  mood!: QuackMood | null;

  @ApiProperty({ type: String, nullable: true })
  userId!: string | null;

  @ApiProperty({ type: String, format: 'date-time' })
  createdAt!: Date;

  @ApiProperty({ type: QuackUserDto, nullable: true })
  user!: QuackUserDto | null;

  @ApiProperty({ type: PollResponseDto, nullable: true })
  poll!: PollResponseDto | null;

  @ApiProperty({ type: String, format: 'date-time', nullable: true })
  deletedAt!: Date | null;

  @ApiProperty({ type: String, nullable: true })
  parentId!: string | null;

  @ApiProperty({ type: String, nullable: true })
  rootId!: string | null;

  @ApiProperty()
  replyCount!: number;

  @ApiProperty({ type: Object, nullable: true })
  parent!: Quack['parent'];

  static fromDomain(quack: Quack): QuackResponseDto {
    if (!quack.user && !quack.deletedAt) {
      throw new Error(
        `QuackResponseDto.fromDomain expected quack.user to be loaded for quack ${quack.id}`,
      );
    }
    return {
      id: quack.id,
      poll: quack.poll ?? null,
      text: quack.text,
      mood: quack.mood ?? null,
      userId: quack.userId,
      createdAt: quack.createdAt,
      user: quack.deletedAt ? null : (quack.user ?? null),
      deletedAt: quack.deletedAt ?? null,
      parentId: quack.parentId ?? null,
      rootId: quack.rootId ?? null,
      replyCount: quack.replyCount ?? 0,
      parent: quack.parent ?? null,
    };
  }
}
