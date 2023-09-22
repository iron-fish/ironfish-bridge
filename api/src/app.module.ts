/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/. */
import {
  MiddlewareConsumer,
  Module,
  NestModule,
  RequestMethod,
} from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import joi from 'joi';
import { ApiConfigModule } from './api-config/api-config.module';
import { AuthModule } from './auth/auth.module';
import { BridgeRestModule } from './bridge/bridge.rest.module';
import { RequireSslMiddleware } from './common/middlewares/require-ssl.middleware';
import { HealthRestModule } from './health/health.rest.module';
import { LoggerModule } from './logger/logger.module';

export const JOBS_MODULES = [];

export const REST_MODULES = [HealthRestModule, BridgeRestModule];

@Module({
  imports: [
    ApiConfigModule,
    AuthModule,
    ConfigModule.forRoot({
      isGlobal: true,
      validationSchema: joi.object({
        DATABASE_URL: joi.string().required(),
        DYNO: joi.string().allow('').default(''),
        GRAPHILE_CONCURRENCY: joi.number().required(),
        IRONFISH_BRIDGE_API_KEY: joi.string().required(),
        PORT: joi.number().default(8003),
      }),
    }),
    LoggerModule,
    ...JOBS_MODULES,
    ...REST_MODULES,
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer): void {
    consumer
      .apply(RequireSslMiddleware)
      .forRoutes({ path: '*', method: RequestMethod.ALL });
  }
}
