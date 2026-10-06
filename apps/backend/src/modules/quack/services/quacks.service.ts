import { Quack, QuackMood } from '@/modules/quack/domain/quack';
import { searchQuacks } from '@/modules/quack/domain/search-quacks';
import { QuackRepository } from '@/modules/quack/repositories/quack.repository';
import { Identity } from '@/shared/auth/domain/identity';
import { Injectable } from '@nestjs/common';

@Injectable()
export class QuacksService {
  constructor(private readonly quackRepository: QuackRepository) {}

  async getQuacks(query = ''): Promise<Quack[]> {
    return searchQuacks(await this.quackRepository.getQuacks(), query);
  }

  async recordUsage(
    user: Identity,
    event: 'feed' | 'search' | 'open',
  ): Promise<void> {
    await this.quackRepository.recordUsage(user.id, event);
  }

  async createQuack(
    user: Identity,
    quackData: { text: string; mood?: QuackMood | null },
  ): Promise<Quack> {
    return this.quackRepository.createQuack({
      text: quackData.text,
      mood: quackData.mood,
      // the author is taken from the session, never from the request body
      userId: user.id,
    });
  }
}
