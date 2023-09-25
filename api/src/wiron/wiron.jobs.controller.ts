/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/. */
import { Controller, UseFilters } from '@nestjs/common';
import { MessagePattern } from '@nestjs/microservices';
import { BridgeRequestStatus } from '@prisma/client';
import { ethers } from 'ethers';
import { ApiConfigService } from '../api-config/api-config.service';
import { BridgeService } from '../bridge/bridge.service';
import { WIRON_CONTRACT_ADDRESS } from '../common/constants';
import { WIron__factory } from '../contracts';
import { GraphileWorkerPattern } from '../graphile-worker/enums/graphile-worker-pattern';
import { GraphileWorkerException } from '../graphile-worker/graphile-worker-exception';
import { MintWIronOptions } from './interfaces/mint-wiron-options';

@Controller()
export class WIronJobsController {
  constructor(
    private readonly config: ApiConfigService,
    private readonly bridgeService: BridgeService,
  ) {}

  @MessagePattern(GraphileWorkerPattern.MINT_WIRON)
  @UseFilters(new GraphileWorkerException())
  async mint(options: MintWIronOptions) {
    const wIronDeployerPrivateKey = this.config.get<string>(
      'WIRON_DEPLOYER_PRIVATE_KEY',
    );
    const provider = new ethers.InfuraProvider('sepolia');
    const wallet = new ethers.Wallet(wIronDeployerPrivateKey, provider);
    const contract = WIron__factory.connect(WIRON_CONTRACT_ADDRESS, wallet);

    const result = await contract.mint(options.destination, options.amount);
    await this.bridgeService.updateRequest({
      id: options.bridgeRequest,
      status: BridgeRequestStatus.PENDING_ON_DESTINATION_CHAIN,
      destination_transaction: result.hash,
    });
  }
}
