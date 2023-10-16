/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/. */
import { Controller, UseFilters } from '@nestjs/common';
import { MessagePattern } from '@nestjs/microservices';
import { BridgeRequestStatus, Chain, FailureReason } from '@prisma/client';
import { ethers } from 'ethers';
import { ApiConfigService } from '../api-config/api-config.service';
import { BridgeService } from '../bridge/bridge.service';
import {
  SEPOLIA_BLOCK_TIME_MS,
  SEPOLIA_EXPLORER_URL,
  WIRON_CONTRACT_ADDRESS,
} from '../common/constants';
import { WIron, WIron__factory } from '../contracts';
import { GraphileWorkerPattern } from '../graphile-worker/enums/graphile-worker-pattern';
import { GraphileWorkerService } from '../graphile-worker/graphile-worker.service';
import { GraphileWorkerException } from '../graphile-worker/graphile-worker-exception';
import { GraphileWorkerHandlerResponse } from '../graphile-worker/interfaces/graphile-worker-handler-response';
import { LoggerService } from '../logger/logger.service';
import { PrismaService } from '../prisma/prisma.service';
import { SepoliaHeadsService } from '../sepolia-heads/sepolia-heads.service';
import { BurnWIronOptions } from './interfaces/burn-wiron-options';
import { MintWIronOptions } from './interfaces/mint-wiron-options';
import { RefreshBurnWIronTransactionStatusOptions } from './interfaces/refresh-burn-wiron-transaction-status-options';
import { RefreshMintWIronTransactionStatusOptions } from './interfaces/refresh-mint-wiron-transaction-status-options';

@Controller()
export class WIronJobsController {
  constructor(
    private readonly bridgeService: BridgeService,
    private readonly config: ApiConfigService,
    private readonly logger: LoggerService,
    private readonly graphileWorkerService: GraphileWorkerService,
    private readonly prisma: PrismaService,
    private readonly sepoliaHeadsService: SepoliaHeadsService,
  ) {}

  @MessagePattern(GraphileWorkerPattern.MINT_WIRON)
  @UseFilters(new GraphileWorkerException())
  async mint(
    options: MintWIronOptions,
  ): Promise<GraphileWorkerHandlerResponse> {
    const bridgeRequest = await this.bridgeService.find(options.bridgeRequest);
    if (!bridgeRequest) {
      this.logger.error(
        `No bridge request found for ${options.bridgeRequest}`,
        '',
      );
      return { requeue: false };
    }

    if (
      bridgeRequest.status !==
      BridgeRequestStatus.PENDING_DESTINATION_MINT_TRANSACTION_CREATION
    ) {
      this.logger.error(
        `Invalid status for minting WIRON. Bridge request '${options.bridgeRequest}'`,
        '',
      );
      return { requeue: false };
    }

    const { contract } = this.connectWIron();

    let destinationAddress = bridgeRequest.destination_address;
    if (!destinationAddress.startsWith('0x')) {
      destinationAddress = `0x${destinationAddress}`;
    }

    const result = await contract.mint(
      destinationAddress,
      // TODO handle potential error here string -> bigint
      BigInt(bridgeRequest.amount),
    );
    await this.bridgeService.updateRequest({
      id: options.bridgeRequest,
      status:
        BridgeRequestStatus.PENDING_DESTINATION_MINT_TRANSACTION_CONFIRMATION,
      destination_transaction: result.hash,
    });

    const runAt = new Date(
      new Date().getTime() +
        // Use an additional block as a buffer
        (Number(this.config.get<number>('WIRON_FINALITY_HEIGHT_RANGE')) + 1) *
          SEPOLIA_BLOCK_TIME_MS,
    );
    await this.graphileWorkerService.addJob<RefreshMintWIronTransactionStatusOptions>(
      GraphileWorkerPattern.REFRESH_MINT_WIRON_TRANSACTION_STATUS,
      { bridgeRequestId: options.bridgeRequest },
      { jobKey: `refresh_mint_wiron_${options.bridgeRequest}`, runAt },
    );

    return { requeue: false };
  }

  @MessagePattern(GraphileWorkerPattern.REFRESH_WIRON_TRANSFERS)
  @UseFilters(new GraphileWorkerException())
  async refreshTransfers(): Promise<GraphileWorkerHandlerResponse> {
    const { provider, contract } = this.connectWIron();
    const head = await provider.getBlock('latest');
    if (!head) {
      throw new Error('Null head');
    }

    const finalityRange = this.config.get<number>(
      'WIRON_FINALITY_HEIGHT_RANGE',
    );
    const headHeightWithFinality = head.number - finalityRange;
    const currentHead = await this.sepoliaHeadsService.wIronHead();
    const fromBlockHeight = currentHead.height;
    const toBlockHeight = Math.min(
      currentHead.height + this.config.get<number>('WIRON_QUERY_HEIGHT_RANGE'),
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

  private async upsertTransferEvents(
    provider: ethers.InfuraProvider,
    contract: WIron,
    fromBlockHeight: number,
    toBlockHeight: number,
  ): Promise<void> {
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
        status: BridgeRequestStatus.PENDING_SOURCE_BURN_TRANSACTION_CREATION,
      };
    });

    const toBlock = await provider.getBlock(toBlockHeight);
    const records = await this.prisma.$transaction(async (prisma) => {
      if (!toBlock || !toBlock.hash) {
        throw new Error(`Cannot get block at height ${toBlockHeight}`);
      }

      const records = await this.bridgeService.upsertRequests(
        bridgeRequests,
        prisma,
      );
      await this.sepoliaHeadsService.updateWIronHead(
        toBlock.hash,
        toBlock.number,
        prisma,
      );
      return records;
    });

    for (const record of records) {
      await this.graphileWorkerService.addJob<BurnWIronOptions>(
        GraphileWorkerPattern.BURN_WIRON,
        { amount: record.amount, bridgeRequestId: record.id },
        { jobKey: `burn_wiron_${record.id}`, queueName: 'burn_wiron' },
      );
    }
  }

  @MessagePattern(GraphileWorkerPattern.BURN_WIRON)
  @UseFilters(new GraphileWorkerException())
  async burn(
    options: BurnWIronOptions,
  ): Promise<GraphileWorkerHandlerResponse> {
    const { contract } = this.connectWIron();

    const result = await contract.burn(BigInt(options.amount));
    await this.bridgeService.updateRequest({
      id: options.bridgeRequestId,
      status: BridgeRequestStatus.PENDING_SOURCE_BURN_TRANSACTION_CONFIRMATION,
      source_burn_transaction: result.hash,
    });

    const runAt = new Date(
      new Date().getTime() +
        // Use an additional block as a buffer
        (Number(this.config.get<number>('WIRON_FINALITY_HEIGHT_RANGE')) + 1) *
          SEPOLIA_BLOCK_TIME_MS,
    );
    await this.graphileWorkerService.addJob<RefreshBurnWIronTransactionStatusOptions>(
      GraphileWorkerPattern.REFRESH_BURN_WIRON_TRANSACTION_STATUS,
      { bridgeRequestId: options.bridgeRequestId },
      { jobKey: `refresh_burn_wiron_${options.bridgeRequestId}`, runAt },
    );

    return { requeue: false };
  }

  @MessagePattern(GraphileWorkerPattern.REFRESH_BURN_WIRON_TRANSACTION_STATUS)
  @UseFilters(new GraphileWorkerException())
  async refreshBurnWIronTransactionStatus({
    bridgeRequestId,
  }: RefreshBurnWIronTransactionStatusOptions) {
    const bridgeRequest = await this.bridgeService.find(bridgeRequestId);
    if (!bridgeRequest || !bridgeRequest.source_burn_transaction) {
      this.logger.error(
        `Invalid burn refresh request for '${bridgeRequestId}'`,
        '',
      );
      return { requeue: false };
    }

    const { provider } = this.connectWIron();
    const transaction = await provider.getTransactionReceipt(
      bridgeRequest.source_burn_transaction,
    );
    if (!transaction) {
      this.logger.error(
        `No burn transaction found for ${bridgeRequest.source_burn_transaction}`,
        '',
      );
      return { requeue: false };
    }

    // Try again in a minute if still unconfirmed
    if (
      !transaction.blockHash ||
      (await transaction.confirmations()) <
        this.config.get<number>('WIRON_FINALITY_HEIGHT_RANGE')
    ) {
      this.logger.debug(
        `Retrying for bridge request ${bridgeRequestId} in 60s`,
      );
      const runAt = new Date(new Date().getTime() + 60 * 1000);
      await this.graphileWorkerService.addJob<RefreshBurnWIronTransactionStatusOptions>(
        GraphileWorkerPattern.REFRESH_BURN_WIRON_TRANSACTION_STATUS,
        { bridgeRequestId },
        { jobKey: `refresh_burn_wiron_${bridgeRequestId}`, runAt },
      );
      return { requeue: false };
    }

    if (!transaction.status) {
      this.logger.error(`Bridge request ${bridgeRequestId} failed`, '');
      await this.prisma.$transaction(async (prisma) => {
        const request = await this.bridgeService.updateRequest(
          {
            id: bridgeRequestId,
            status: BridgeRequestStatus.FAILED,
          },
          prisma,
        );
        await this.bridgeService.createFailedRequest(
          request,
          FailureReason.WIRON_BURN_TRANSACTION_FAILED,
          `Burning WIRON failed. Check ${SEPOLIA_EXPLORER_URL}/tx/${transaction.hash}`,
          prisma,
        );
      });
      return { requeue: false };
    }

    await this.bridgeService.updateRequest({
      id: bridgeRequestId,
      status:
        BridgeRequestStatus.PENDING_DESTINATION_RELEASE_TRANSACTION_CREATION,
    });

    return { requeue: false };
  }

  @MessagePattern(GraphileWorkerPattern.REFRESH_MINT_WIRON_TRANSACTION_STATUS)
  @UseFilters(new GraphileWorkerException())
  async refreshMintWIronTransactionStatus({
    bridgeRequestId,
  }: RefreshMintWIronTransactionStatusOptions) {
    const bridgeRequest = await this.bridgeService.find(bridgeRequestId);
    if (!bridgeRequest || !bridgeRequest.destination_transaction) {
      this.logger.error(
        `Invalid mint refresh request for '${bridgeRequestId}'`,
        '',
      );
      return { requeue: false };
    }

    const { provider } = this.connectWIron();
    const transaction = await provider.getTransactionReceipt(
      bridgeRequest.destination_transaction,
    );
    if (!transaction) {
      this.logger.error(
        `No mint transaction found for ${bridgeRequest.destination_transaction}`,
        '',
      );
      return { requeue: false };
    }

    // Try again in a minute if still unconfirmed
    if (
      !transaction.blockHash ||
      (await transaction.confirmations()) <
        this.config.get<number>('WIRON_FINALITY_HEIGHT_RANGE')
    ) {
      this.logger.debug(
        `Retrying for bridge request ${bridgeRequestId} in 60s`,
      );
      const runAt = new Date(new Date().getTime() + 60 * 1000);
      await this.graphileWorkerService.addJob<RefreshMintWIronTransactionStatusOptions>(
        GraphileWorkerPattern.REFRESH_MINT_WIRON_TRANSACTION_STATUS,
        { bridgeRequestId },
        { jobKey: `refresh_mint_wiron_${bridgeRequestId}`, runAt },
      );
      return { requeue: false };
    }

    if (!transaction.status) {
      this.logger.error(`Bridge request ${bridgeRequestId} failed`, '');
      await this.prisma.$transaction(async (prisma) => {
        const request = await this.bridgeService.updateRequest(
          {
            id: bridgeRequestId,
            status: BridgeRequestStatus.FAILED,
          },
          prisma,
        );
        await this.bridgeService.createFailedRequest(
          request,
          FailureReason.WIRON_MINT_TRANSACTION_FAILED,
          `Minting WIRON failed. Check ${SEPOLIA_EXPLORER_URL}/tx/${transaction.hash}`,
          prisma,
        );
      });
      return { requeue: false };
    }

    await this.bridgeService.updateRequest({
      id: bridgeRequestId,
      status: BridgeRequestStatus.CONFIRMED,
    });

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
