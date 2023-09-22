/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/. */
import { INestApplication } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { Test } from '@nestjs/testing';
import { json } from 'express';
import joi from 'joi';
import { JOBS_MODULES, REST_MODULES } from '../app.module';
import { AuthModule } from '../auth/auth.module';

export async function bootstrapTestApp(): Promise<INestApplication> {
  const module = await Test.createTestingModule({
    imports: [
      AuthModule,
      ConfigModule.forRoot({
        envFilePath: '.env.test',
        isGlobal: true,
        validationSchema: joi.object({
          DATABASE_URL: joi.string().required(),
          DYNO: joi.string().allow('').default(''),
          GRAPHILE_CONCURRENCY: joi.number().required(),
          IRONFISH_BRIDGE_API_KEY: joi.string().required(),
          PORT: joi.number().default(8003),
        }),
      }),
      ...JOBS_MODULES,
      ...REST_MODULES,
    ],
  }).compile();

  const app = module.createNestApplication();
  app.use(json({ limit: '10mb' }));
  return app;
}
