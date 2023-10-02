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
import { WIron, WIron__factory } from '../contracts';
import { GraphileWorkerPattern } from '../graphile-worker/enums/graphile-worker-pattern';
import { GraphileWorkerService } from '../graphile-worker/graphile-worker.service';
import { GraphileWorkerException } from '../graphile-worker/graphile-worker-exception';
import { LoggerService } from '../logger/logger.service';
import { PrismaService } from '../prisma/prisma.service';
import { WIronSepoliaHeadService } from '../wiron-sepolia-head/wiron-sepolia-head.service';
import { MintWIronOptions } from './interfaces/mint-wiron-options';

@Controller()
export class WIronJobsController {
  constructor(
    private readonly bridgeService: BridgeService,
    private readonly config: ApiConfigService,
    private readonly logger: LoggerService,
    private readonly graphileWorkerService: GraphileWorkerService,
    private readonly prisma: PrismaService,
    private readonly wIronSepoliaHeadService: WIronSepoliaHeadService,
  ) {}

  @MessagePattern(GraphileWorkerPattern.MINT_WIRON)
  @UseFilters(new GraphileWorkerException())
  async mint(options: MintWIronOptions) {
    const { contract } = this.connectWIron();

    const result = await contract.mint(options.destination, options.amount);
    await this.bridgeService.updateRequest({
      id: options.bridgeRequest,
      status: BridgeRequestStatus.PENDING_ON_DESTINATION_CHAIN,
      destination_transaction: result.hash,
    });
  }

  @MessagePattern(GraphileWorkerPattern.REFRESH_WIRON_TRANSFERS)
  @UseFilters(new GraphileWorkerException())
  async refreshTransfers() {
    const { provider, contract } = this.connectWIron();
    const head = await provider.getBlock('latest');
    if (!head) {
      throw new Error('Null head');
    }

    const finalityRange = this.config.get<number>(
      'WIRON_FINALITY_HEIGHT_RANGE',
    );
    const headHeightWithFinality = head.number - finalityRange;
    const currentHead = await this.wIronSepoliaHeadService.head();
    const fromBlockHeight = currentHead.height;
    const toBlockHeight = Math.min(
      currentHead.height + this.config.get<number>('WIRON_QUERY_HEIGHT_RANGE'),
      headHeightWithFinality,
    );

    // Only query events if there is a range
    if (fromBlockHeight < toBlockHeight - 1) {
      this.logger.debug(
        `Refreshing blocks from height ${fromBlockHeight} to ${toBlockHeight}`,
      );
      const filter = contract.filters.TransferWithMetadata(
        undefined,
        this.config.get<string>('WIRON_DEPOSIT_ADDRESS'),
      );
      const events = await contract.queryFilter(
        filter,
        fromBlockHeight,
        // Upper bound is inclusive
        toBlockHeight - 1,
      );
      this.logger.debug(`Processing ${events.length} bridge requests`);

      const bridgeRequests = events.map((event) => {
        let destinationAddress = event.args[3];
        if (destinationAddress.startsWith('0x')) {
          destinationAddress = destinationAddress.slice(2);
        }

        return {
          source_address: event.args[0],
          destination_address: destinationAddress,
          amount: event.args[2].toString(),
          asset: 'WIRON',
          source_chain: Chain.ETHEREUM,
          destination_chain: Chain.IRONFISH,
          source_transaction: event.transactionHash,
          destination_transaction: null,
          status: BridgeRequestStatus.PENDING_WIRON_BURN_TRANSACTION_CREATION,
        };
      });

      const toBlock = await provider.getBlock(toBlockHeight);
      await this.prisma.$transaction(async (prisma) => {
        if (!toBlock || !toBlock.hash) {
          throw new Error(`Cannot get block at height ${toBlockHeight}`);
        }

        await this.bridgeService.upsertRequests(bridgeRequests, prisma);
        await this.wIronSepoliaHeadService.updateHead(
          toBlock.hash,
          toBlock.number,
          prisma,
        );
      });
    }

    const runAt = new Date(
      new Date().getTime() +
        this.config.get<number>('REFRESH_WIRON_TRANSFERS_PERIOD_MINUTES') *
          60 *
          1000,
    );
    await this.graphileWorkerService.addJob(
      GraphileWorkerPattern.REFRESH_WIRON_TRANSFERS,
      {},
      { runAt, jobKey: 'refresh_wiron_transfers' },
    );

    return { requeue: false };
  }

  connectWIron(): {
    provider: ethers.InfuraProvider;
    contract: WIron;
  } {
    const wIronDeployerPrivateKey = this.config.get<string>(
      'WIRON_DEPLOYER_PRIVATE_KEY',
    );
    const provider = new ethers.InfuraProvider('sepolia');
    const wallet = new ethers.Wallet(wIronDeployerPrivateKey, provider);
    const contract = WIron__factory.connect(WIRON_CONTRACT_ADDRESS, wallet);
    return { provider, contract };
  }
}
