import { CreatePoll } from '@/modules/quack/domain/poll';
import { Quack, QuackMood } from '@/modules/quack/domain/quack';
import { searchQuacks } from '@/modules/quack/domain/search-quacks';
import {
  QuackRepository,
  ReplyPage,
} from '@/modules/quack/repositories/quack.repository';
import { Identity } from '@/shared/auth/domain/identity';
import { ForbiddenException, Injectable } from '@nestjs/common';

@Injectable()
export class QuacksService {
  constructor(private readonly quackRepository: QuackRepository) {}

  async getQuacks(
    query = '',
    userId?: string,
    scope: 'all' | 'mine' = 'all',
  ): Promise<Quack[]> {
    return searchQuacks(
      await this.quackRepository.getQuacks(
        userId,
        scope,
        Boolean(query.trim()),
      ),
      query,
    );
  }

  async getReplies(
    rootId: string,
    user: Identity,
    cursor?: string,
    target?: string,
  ): Promise<ReplyPage> {
    return this.quackRepository.getReplies(rootId, user.id, cursor, target);
  }

  async getQuack(id: string, user: Identity): Promise<Quack> {
    return this.quackRepository.getQuack(id, user.id);
  }

  async deleteQuack(id: string, user: Identity): Promise<void> {
    const quack = await this.quackRepository.getQuack(id, user.id);
    if (quack.deletedAt) return;
    // Read the persisted role, not the potentially stale session role.
    const role = await this.quackRepository.getUserRole(user.id);
    if (quack.userId !== user.id && role !== 'admin') {
      throw new ForbiddenException(
        'You do not have permission to delete this post',
      );
    }
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
    quackData: {
      text: string;
      mood?: QuackMood | null;
      poll?: CreatePoll;
      parentId?: string;
    },
  ): Promise<Quack> {
    return this.quackRepository.createQuack({
      text: quackData.text,
      ...(quackData.parentId ? { parentId: quackData.parentId } : {}),
      mood: quackData.mood,
      ...(quackData.poll ? { poll: quackData.poll } : {}),
      // the author is taken from the session, never from the request body
      userId: user.id,
    });
  }
}
