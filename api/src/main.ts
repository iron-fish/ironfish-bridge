/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/. */
import { NestFactory } from '@nestjs/core';
import {
  ExpressAdapter,
  NestExpressApplication,
} from '@nestjs/platform-express';
import compression from 'compression';
import express from 'express';
import { json } from 'express';
import helmet from 'helmet';
import http from 'http';
import { ApiConfigService } from './api-config/api-config.service';
import { AppModule } from './app.module';
import { LoggerService } from './logger/logger.service';

declare const module: {
  hot?: {
    accept(): void;
    dispose(callback?: () => void): void;
  };
};

async function bootstrap(): Promise<void> {
  const server = express();
  const app = await NestFactory.create<NestExpressApplication>(
    AppModule,
    new ExpressAdapter(server),
  );
  const config = app.get(ApiConfigService);
  const logger = app.get(LoggerService);

  app.use(compression());
  app.use(helmet());
  app.use(json({ limit: '10mb' }));

  await app.init();

  const port = config.get<number>('PORT');
  logger.info(`Starting API on PORT ${port}`);
  const httpServer = http.createServer(server).listen(port);

  if (module.hot) {
    module.hot.accept();
    module.hot.dispose(() => {
      httpServer.close();
      void app.close();
    });
  }
}

// eslint-disable-next-line no-console
bootstrap().catch(console.error);
