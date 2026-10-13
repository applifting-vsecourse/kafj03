import { EventEmitter } from 'node:events';
import { Logger, ServiceUnavailableException } from '@nestjs/common';
import { Client } from 'pg';
import { PollEventsService } from './poll-events.service';

jest.mock('pg', () => ({ Client: jest.fn() }));

class FakeClient extends EventEmitter {
  connect = jest.fn().mockResolvedValue(undefined);
  query = jest.fn().mockResolvedValue(undefined);
  end = jest.fn().mockResolvedValue(undefined);
}

describe('PollEventsService lifecycle', () => {
  let clients: FakeClient[];
  let service: PollEventsService;
  beforeEach(() => {
    jest.useFakeTimers();
    clients = [];
    (Client as unknown as jest.Mock).mockImplementation(() => {
      const client = new FakeClient();
      clients.push(client);
      return client;
    });
    jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
    service = new PollEventsService();
  });
  afterEach(async () => {
    await service.onModuleDestroy();
    jest.useRealTimers();
    jest.restoreAllMocks();
  });

  it('closes streams on database loss and reconnects with a new listener', async () => {
    await service.onModuleInit();
    expect(clients[0].query).toHaveBeenCalledWith('LISTEN quack_poll_changed');
    const failed = jest.fn();
    const subscription = service.events().subscribe({ error: failed });
    clients[0].emit('error', new Error('Connection lost'));
    expect(failed).toHaveBeenCalledTimes(1);
    expect(() => service.events()).toThrow(ServiceUnavailableException);
    await jest.advanceTimersByTimeAsync(1000);
    expect(clients).toHaveLength(2);
    const received: unknown[] = [];
    const next = service.events().subscribe((event) => received.push(event));
    clients[1].emit('notification', {
      channel: 'quack_poll_changed',
      payload: JSON.stringify({ quackId: 'q', revision: 1 }),
    });
    expect(received).toContainEqual({
      type: 'poll-changed',
      data: { quackId: 'q', revision: 1 },
    });
    next.unsubscribe();
    subscription.unsubscribe();
  });

  it('ignores malformed notifications and sends heartbeats', async () => {
    await service.onModuleInit();
    const received: unknown[] = [];
    const subscription = service
      .events()
      .subscribe((event) => received.push(event));
    clients[0].emit('notification', {
      channel: 'quack_poll_changed',
      payload: '[]',
    });
    clients[0].emit('notification', {
      channel: 'quack_poll_changed',
      payload: '{"quackId":12}',
    });
    clients[0].emit('notification', {
      channel: 'other',
      payload: '{"quackId":"q"}',
    });
    expect(received).toEqual([{ type: 'ready', data: {} }]);
    await jest.advanceTimersByTimeAsync(10_000);
    expect(received).toContainEqual({ type: 'heartbeat', data: {} });
    subscription.unsubscribe();
  });

  it('cancels reconnect when the application shuts down', async () => {
    await service.onModuleInit();
    clients[0].emit('end');
    await service.onModuleDestroy();
    await jest.advanceTimersByTimeAsync(2000);
    expect(clients).toHaveLength(1);
  });
});
