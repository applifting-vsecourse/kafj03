import { CreatePoll } from '@/modules/quack/domain/poll';
import { Quack, QuackMood } from '@/modules/quack/domain/quack';
import { searchQuacks } from '@/modules/quack/domain/search-quacks';
import { QuackRepository } from '@/modules/quack/repositories/quack.repository';
import { Identity } from '@/shared/auth/domain/identity';
import { Injectable } from '@nestjs/common';

@Injectable()
export class QuacksService {
  constructor(private readonly quackRepository: QuackRepository) {}

  async getQuacks(query = '', userId?: string): Promise<Quack[]> {
    return searchQuacks(await this.quackRepository.getQuacks(userId), query);
  }

  async getQuack(id: string, user: Identity): Promise<Quack> {
    return this.quackRepository.getQuack(id, user.id);
  }

  async deleteQuack(id: string, user: Identity): Promise<void> {
    await this.quackRepository.deleteQuack(id, user.id);
  }

  async recordUsage(
    user: Identity,
    event: 'feed' | 'search' | 'open',
  ): Promise<void> {
    await this.quackRepository.recordUsage(user.id, event);
  }

  async createQuack(
    user: Identity,
    quackData: { text: string; mood?: QuackMood | null; poll?: CreatePoll },
  ): Promise<Quack> {
    return this.quackRepository.createQuack({
      text: quackData.text,
      mood: quackData.mood,
      ...(quackData.poll ? { poll: quackData.poll } : {}),
      // the author is taken from the session, never from the request body
      userId: user.id,
    });
  }
}
