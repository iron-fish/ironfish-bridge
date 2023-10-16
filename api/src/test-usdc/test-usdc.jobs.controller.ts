/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/. */
import { Controller, UseFilters } from '@nestjs/common';
import { MessagePattern } from '@nestjs/microservices';
import { BridgeRequestStatus, Chain } from '@prisma/client';
import { ethers } from 'ethers';
import { ApiConfigService } from '../api-config/api-config.service';
import { BridgeService } from '../bridge/bridge.service';
import {
  SEPOLIA_BLOCK_TIME_MS,
  TEST_USDC_CONTRACT_ADDRESS,
} from '../common/constants';
import { TestUSDC, TestUSDC__factory } from '../contracts';
import { GraphileWorkerPattern } from '../graphile-worker/enums/graphile-worker-pattern';
import { GraphileWorkerService } from '../graphile-worker/graphile-worker.service';
import { GraphileWorkerException } from '../graphile-worker/graphile-worker-exception';
import { GraphileWorkerHandlerResponse } from '../graphile-worker/interfaces/graphile-worker-handler-response';
import { LoggerService } from '../logger/logger.service';
import { PrismaService } from '../prisma/prisma.service';
import { SepoliaHeadsService } from '../sepolia-heads/sepolia-heads.service';
import { RefreshReleaseTestUSDCTransactionStatusOptions } from './interfaces/refresh-release-test-usdc-transaction-status-options';
import { ReleaseTestUSDCOptions } from './interfaces/release-test-usdc-options';

@Controller()
export class TestUsdcJobsController {
  constructor(
    private readonly bridgeService: BridgeService,
    private readonly config: ApiConfigService,
    private readonly logger: LoggerService,
    private readonly graphileWorkerService: GraphileWorkerService,
    private readonly prisma: PrismaService,
    private readonly sepoliaHeadsService: SepoliaHeadsService,
  ) {}

  @MessagePattern(GraphileWorkerPattern.REFRESH_TEST_USDC_TRANSFERS)
  @UseFilters(new GraphileWorkerException())
  async refreshTransfers(): Promise<GraphileWorkerHandlerResponse> {
    const { provider, contract } = this.connectTestUsdc();
    const head = await provider.getBlock('latest');
    if (!head) {
      throw new Error('Null head');
    }

    const finalityRange = this.config.get<number>(
      'TEST_USDC_FINALITY_HEIGHT_RANGE',
    );
    const headHeightWithFinality = head.number - finalityRange;
    const currentHead = await this.sepoliaHeadsService.testUsdcHead();
    const fromBlockHeight = currentHead.height;
    const toBlockHeight = Math.min(
      currentHead.height +
        this.config.get<number>('TEST_USDC_QUERY_HEIGHT_RANGE'),
      headHeightWithFinality,
    );

    // Only query events if there is a range
    if (fromBlockHeight < toBlockHeight - 1) {
      await this.upsertTransferEvents(
        provider,
        contract,
        fromBlockHeight,
        toBlockHeight,
      );
    }

    const runAt = new Date(
      new Date().getTime() +
        this.config.get<number>('REFRESH_TEST_USDC_TRANSFERS_PERIOD_MINUTES') *
          60 *
          1000,
    );
    await this.graphileWorkerService.addJob(
      GraphileWorkerPattern.REFRESH_TEST_USDC_TRANSFERS,
      {},
      { runAt, jobKey: 'refresh_test_usdc_transfers' },
    );

    return { requeue: false };
  }

  @MessagePattern(GraphileWorkerPattern.RELEASE_TEST_USDC)
  @UseFilters(new GraphileWorkerException())
  async release(
    options: ReleaseTestUSDCOptions,
  ): Promise<GraphileWorkerHandlerResponse> {
    const bridgeRequest = await this.bridgeService.find(
      options.bridgeRequestId,
    );
    if (!bridgeRequest) {
      this.logger.error(
        `No bridge request found for ${options.bridgeRequestId}`,
        '',
      );
      return { requeue: false };
    }

    if (
      bridgeRequest.status !==
      BridgeRequestStatus.PENDING_DESTINATION_RELEASE_TRANSACTION_CREATION
    ) {
      this.logger.error(
        `Invalid status for releasing TestUSDC. Bridge request '${options.bridgeRequestId}'`,
        '',
      );
      return { requeue: false };
    }

    const { contract } = this.connectTestUsdc();

    let destinationAddress = bridgeRequest.destination_address;
    if (!destinationAddress.startsWith('0x')) {
      destinationAddress = `0x${destinationAddress}`;
    }

    const result = await contract.transfer(
      destinationAddress,
      BigInt(bridgeRequest.amount),
    );
    await this.bridgeService.updateRequest({
      id: options.bridgeRequestId,
      status:
        BridgeRequestStatus.PENDING_DESTINATION_RELEASE_TRANSACTION_CONFIRMATION,
      destination_transaction: result.hash,
    });

    const runAt = new Date(
      new Date().getTime() +
        // Use an additional block as a buffer
        (Number(this.config.get<number>('WIRON_FINALITY_HEIGHT_RANGE')) + 1) *
          SEPOLIA_BLOCK_TIME_MS,
    );
    await this.graphileWorkerService.addJob<RefreshReleaseTestUSDCTransactionStatusOptions>(
      GraphileWorkerPattern.REFRESH_RELEASE_TEST_USDC_TRANSACTION_STATUS,
      { bridgeRequestId: options.bridgeRequestId },
      { jobKey: `refresh_release_test_usdc_${options.bridgeRequestId}`, runAt },
    );

    return { requeue: false };
  }

  private async upsertTransferEvents(
    provider: ethers.InfuraProvider,
    contract: TestUSDC,
    fromBlockHeight: number,
    toBlockHeight: number,
  ): Promise<void> {
    this.logger.debug(
      `Refreshing blocks from height ${fromBlockHeight} to ${toBlockHeight}`,
    );
    const filter = contract.filters.TransferWithMetadata(
      undefined,
      this.config.get<string>('TEST_USDC_DEPOSIT_ADDRESS'),
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
        asset: 'Test USDC',
        source_chain: Chain.ETHEREUM,
        destination_chain: Chain.IRONFISH,
        source_transaction: event.transactionHash,
        destination_transaction: null,
        status:
          BridgeRequestStatus.PENDING_DESTINATION_MINT_TRANSACTION_CREATION,
      };
    });

    const toBlock = await provider.getBlock(toBlockHeight);
    await this.prisma.$transaction(async (prisma) => {
      if (!toBlock || !toBlock.hash) {
        throw new Error(`Cannot get block at height ${toBlockHeight}`);
      }

      const records = await this.bridgeService.upsertRequests(
        bridgeRequests,
        prisma,
      );
      await this.sepoliaHeadsService.updateTestUsdcHead(
        toBlock.hash,
        toBlock.number,
        prisma,
      );
      return records;
    });
  }

  connectTestUsdc(): {
    provider: ethers.InfuraProvider;
    contract: TestUSDC;
  } {
    const wIronDeployerPrivateKey = this.config.get<string>(
      'TEST_USDC_DEPLOYER_PRIVATE_KEY',
    );
    const provider = new ethers.InfuraProvider('sepolia');
    const wallet = new ethers.Wallet(wIronDeployerPrivateKey, provider);
    const contract = TestUSDC__factory.connect(
      TEST_USDC_CONTRACT_ADDRESS,
      wallet,
    );
    return { provider, contract };
  }
}
