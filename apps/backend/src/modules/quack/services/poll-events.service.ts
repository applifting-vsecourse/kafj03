import {
  Injectable,
  Logger,
  MessageEvent,
  OnModuleDestroy,
  OnModuleInit,
  ServiceUnavailableException,
} from '@nestjs/common';
import { Client } from 'pg';
import { interval, map, merge, Observable, of, Subject } from 'rxjs';

@Injectable()
export class PollEventsService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(PollEventsService.name);
  private client?: Client;
  private eventsSubject = new Subject<MessageEvent>();
  private reconnectTimer?: ReturnType<typeof setTimeout>;
  private isStopped = false;
  private isConnected = false;

  async onModuleInit(): Promise<void> {
    await this.connect();
  }

  private async connect(): Promise<void> {
    if (this.isStopped) return;
    const client = new Client({
      connectionString: process.env.DATABASE_URL,
      connectionTimeoutMillis: 3000,
      keepAlive: true,
    });
    this.client = client;
    client.on('notification', (message) => {
      if (message.channel !== 'quack_poll_changed' || !message.payload) return;
      try {
        const data: unknown = JSON.parse(message.payload);
        if (
          typeof data !== 'object' ||
          data === null ||
          !('quackId' in data) ||
          typeof data.quackId !== 'string'
        )
          return;
        this.eventsSubject.next({ type: 'poll-changed', data });
      } catch {
        this.logger.warn('Ignoring malformed poll notification');
      }
    });
    const disconnect = (): void => {
      if (this.client !== client || this.isStopped) return;
      this.client = undefined;
      this.isConnected = false;
      // Close existing SSE streams so clients visibly lose synchronization.
      this.eventsSubject.error(new Error('Poll synchronization disconnected'));
      this.eventsSubject = new Subject<MessageEvent>();
      void client.end().catch(() => undefined);
      this.reconnectTimer = setTimeout(() => {
        void this.connect();
      }, 1000);
    };
    client.on('error', disconnect);
    client.on('end', disconnect);
    try {
      await client.connect();
      await client.query('LISTEN quack_poll_changed');
      if (this.client === client && !this.isStopped) this.isConnected = true;
    } catch {
      this.logger.warn('Poll synchronization unavailable; reconnecting');
      disconnect();
    }
  }

  events(): Observable<MessageEvent> {
    if (!this.isConnected)
      throw new ServiceUnavailableException('Poll synchronization unavailable');
    return merge(
      of({ type: 'ready', data: {} }),
      this.eventsSubject.asObservable(),
      interval(10_000).pipe(map(() => ({ type: 'heartbeat', data: {} }))),
    );
  }

  async onModuleDestroy(): Promise<void> {
    this.isStopped = true;
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
    this.eventsSubject.complete();
    await this.client?.end();
  }
}
