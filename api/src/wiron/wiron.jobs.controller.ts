/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/. */
import { Controller, UseFilters } from '@nestjs/common';
import { MessagePattern } from '@nestjs/microservices';
import { BridgeRequestStatus, Chain } from '@prisma/client';
import { ethers } from 'ethers';
import { ApiConfigService } from '../api-config/api-config.service';
import { BridgeService } from '../bridge/bridge.service';
import { WIRON_CONTRACT_ADDRESS } from '../common/constants';
import { WIron__factory } from '../contracts';
import { GraphileWorkerPattern } from '../graphile-worker/enums/graphile-worker-pattern';
import { GraphileWorkerService } from '../graphile-worker/graphile-worker.service';
import { GraphileWorkerException } from '../graphile-worker/graphile-worker-exception';
import { WIronSepoliaHeadService } from '../wiron-sepolia-head/wiron-sepolia-head.service';
import { MintWIronOptions } from './interfaces/mint-wiron-options';

@Controller()
export class WIronJobsController {
  constructor(
    private readonly bridgeService: BridgeService,
    private readonly config: ApiConfigService,
    private readonly graphileWorkerService: GraphileWorkerService,
    private readonly wIronSepoliaHeadService: WIronSepoliaHeadService,
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

    await contract.mint(options.destination, options.amount);
  }

  @MessagePattern(GraphileWorkerPattern.REFRESH_WIRON_TRANSFERS)
  @UseFilters(new GraphileWorkerException())
  async refreshTransfers() {
    const refreshPeriodMinutes = 2;
    const finalityRange = 10;
    const depositAddress = '0x26c6535396ba6ef996a81e4f2ac7956c91da5e1f';

    const wIronDeployerPrivateKey = this.config.get<string>(
      'WIRON_DEPLOYER_PRIVATE_KEY',
    );
    const provider = new ethers.InfuraProvider('sepolia');
    const wallet = new ethers.Wallet(wIronDeployerPrivateKey, provider);
    const contract = WIron__factory.connect(WIRON_CONTRACT_ADDRESS, wallet);

    const head = await provider.getBlock('latest');
    if (!head) {
      throw new Error('Null head');
    }
    const headHeightWithFinality = head.number - finalityRange;

    const queryRange = 100;
    const currentHead = await this.wIronSepoliaHeadService.head();
    const fromBlockHeight = currentHead.height;
    const toBlockHeight = Math.min(
      currentHead.height + queryRange,
      headHeightWithFinality,
    );

    // Only get events if there is a range
    if (fromBlockHeight < toBlockHeight - 1) {
      const toBlock = await provider.getBlock(toBlockHeight);
      if (!toBlock) {
        throw new Error(`Cannot get block at height ${toBlockHeight}`);
      }
      if (!toBlock.hash) {
        throw new Error(`Null hash for block ${toBlockHeight}`);
      }

      const filter = contract.filters.TransferWithMetadata(
        undefined,
        depositAddress,
      );
      // Upper bound is inclusive
      const events = await contract.queryFilter(
        filter,
        fromBlockHeight,
        toBlockHeight - 1,
      );

      const bridgeRequests = events.map((event) => ({
        source_address: event.args[0],
        destination_address: event.args[1],
        asset: 'WIRON',
        source_chain: Chain.ETHEREUM,
        destination_chain: Chain.IRONFISH,
        source_transaction: event.transactionHash,
        destination_transaction: null,
        status: BridgeRequestStatus.CREATED,
      }));
      await this.bridgeService.upsertRequests(bridgeRequests);
      await this.wIronSepoliaHeadService.updateHead(
        toBlock.hash,
        toBlock.number,
      );
    }

    const runAt = new Date(
      new Date().getTime() + refreshPeriodMinutes * 60 * 1000,
    );
    await this.graphileWorkerService.addJob(
      GraphileWorkerPattern.REFRESH_WIRON_TRANSFERS,
      {},
      { runAt },
    );

    return { requeue: false };
  }
}
