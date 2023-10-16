/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/. */
import { Controller, UseFilters } from '@nestjs/common';
import { MessagePattern } from '@nestjs/microservices';
import { BridgeRequestStatus } from '@prisma/client';
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
import { RefreshReleaseTestUSDCTransactionStatusOptions } from './interfaces/refresh-release-test-usdc-transaction-status-options';
import { ReleaseTestUSDCOptions } from './interfaces/release-test-usdc-options';

@Controller()
export class TestUSDCJobsController {
  constructor(
    private readonly bridgeService: BridgeService,
    private readonly config: ApiConfigService,
    private readonly logger: LoggerService,
    private readonly graphileWorkerService: GraphileWorkerService,
  ) {}

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

    const { contract } = this.connectTestUSDC();

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

  connectTestUSDC(): {
    provider: ethers.InfuraProvider;
    contract: TestUSDC;
  } {
    const testUSDCDeployerPrivateKey = this.config.get<string>(
      'TEST_USDC_DEPLOYER_PRIVATE_KEY',
    );
    const provider = new ethers.InfuraProvider('sepolia');
    const wallet = new ethers.Wallet(testUSDCDeployerPrivateKey, provider);
    const contract = TestUSDC__factory.connect(
      TEST_USDC_CONTRACT_ADDRESS,
      wallet,
    );
    return { provider, contract };
  }
}
