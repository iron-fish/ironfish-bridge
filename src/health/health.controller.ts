/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/. */
import { Controller, Get } from '@nestjs/common';
import { GraphileWorkerService } from '../graphile-worker/graphile-worker.service';

@Controller('health')
export class HealthController {
  constructor(private readonly graphileWorkerService: GraphileWorkerService) {}

  @Get()
  health(): string {
    return 'OK';
  }
}
