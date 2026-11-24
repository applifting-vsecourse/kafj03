import { INestApplication } from '@nestjs/common';
import { toNodeHandler } from 'better-auth/node';
import * as cookieParser from 'cookie-parser';
import * as express from 'express';
import { BetterAuth } from './shared/auth/providers/better-auth.provider';
import { Config } from './shared/config/config.service';

export function configureHttp(app: INestApplication): void {
  const config = app.get(Config);
  app.enableCors({
    origin: [config.backendUrl, config.frontendUrl],
    credentials: true,
  });

  app.use(cookieParser());

  const appInstance = app.getHttpAdapter().getInstance();
  const betterAuth = app.get<BetterAuth>('BetterAuth');
  // Express 5 requires a named wildcard for the BetterAuth routes.
  appInstance.all('/api/auth/*splat', toNodeHandler(betterAuth));
  appInstance.use(express.json());
  app.setGlobalPrefix('api');
}
