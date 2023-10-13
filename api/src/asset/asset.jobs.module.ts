/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/. */
import { Module } from '@nestjs/common';
import { ApiConfigModule } from '../api-config/api-config.module';
import { AssetSepoliaHeadModule } from '../asset-sepolia-head/asset-sepolia-head.module';
import { BridgeModule } from '../bridge/bridge.module';
import { GraphileWorkerModule } from '../graphile-worker/graphile-worker.module';
import { LoggerModule } from '../logger/logger.module';
import { PrismaModule } from '../prisma/prisma.module';
import { AssetJobsController } from './asset.jobs.controller';

@Module({
  controllers: [AssetJobsController],
  imports: [
    ApiConfigModule,
    BridgeModule,
    GraphileWorkerModule,
    LoggerModule,
    PrismaModule,
    AssetSepoliaHeadModule,
  ],
})
export class AssetJobsModule {}
