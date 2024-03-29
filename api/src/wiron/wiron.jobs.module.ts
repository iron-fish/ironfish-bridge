/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/. */
import { Module } from '@nestjs/common';
import { ApiConfigModule } from '../api-config/api-config.module';
import { BridgeModule } from '../bridge/bridge.module';
import { GraphileWorkerModule } from '../graphile-worker/graphile-worker.module';
import { LoggerModule } from '../logger/logger.module';
import { PrismaModule } from '../prisma/prisma.module';
import { SepoliaHeadsModule } from '../sepolia-heads/sepolia-heads.module';
import { WIronJobsController } from './wiron.jobs.controller';

@Module({
  controllers: [WIronJobsController],
  imports: [
    ApiConfigModule,
    BridgeModule,
    GraphileWorkerModule,
    LoggerModule,
    PrismaModule,
    SepoliaHeadsModule,
  ],
})
export class WIronJobsModule {}
