/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/. */
import { INestApplication } from '@nestjs/common';
import { BridgeRequestStatus } from '@prisma/client';
import { ContractTransactionResponse } from 'ethers';
import { mock } from 'jest-mock-extended';
import { BridgeService } from '../bridge/bridge.service';
import { TestUSDC, TestUSDC__factory } from '../contracts';
import { GraphileWorkerPattern } from '../graphile-worker/enums/graphile-worker-pattern';
import { GraphileWorkerService } from '../graphile-worker/graphile-worker.service';
import { bridgeRequestDTO } from '../test/mocks';
import { bootstrapTestApp } from '../test/test-app';
import { ReleaseTestUSDCOptions } from './interfaces/release-test-usdc-options';
import { TestUSDCJobsController } from './test-usdc.jobs.controller';

describe('TestUSDCJobsController', () => {
  let app: INestApplication;
  let bridgeService: BridgeService;
  let graphileWorkerService: GraphileWorkerService;
  let testUSDCJobsController: TestUSDCJobsController;

  beforeAll(async () => {
    app = await bootstrapTestApp();
    bridgeService = app.get(BridgeService);
    graphileWorkerService = app.get(GraphileWorkerService);
    testUSDCJobsController = app.get(TestUSDCJobsController);
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('release', () => {
    it('calls release on the TestUSDC smart contract', async () => {
      const testUSDCMock = mock<TestUSDC>();

      const amount = '100';
      const destination_address = '0x6637ef23a4378b2c9df51477004c2e2994a2cf4b';
      const request = await bridgeService.upsertRequest(
        bridgeRequestDTO({
          amount,
          destination_address,
          status:
            BridgeRequestStatus.PENDING_DESTINATION_RELEASE_TRANSACTION_CREATION,
        }),
      );
      jest
        .spyOn(TestUSDC__factory, 'connect')
        .mockImplementation(() => testUSDCMock);
      const testUSDCRelease = jest
        .spyOn(testUSDCMock, 'transfer')
        .mockImplementationOnce(
          () =>
            Promise.resolve({
              hash: 'your_hash_key_value',
            }) as Promise<ContractTransactionResponse>,
        );

      const addJob = jest
        .spyOn(graphileWorkerService, 'addJob')
        .mockImplementationOnce(jest.fn());

      const options: ReleaseTestUSDCOptions = {
        bridgeRequestId: request.id,
      };
      await testUSDCJobsController.release(options);

      expect(testUSDCRelease).toHaveBeenCalledTimes(1);
      expect(testUSDCRelease).toHaveBeenCalledWith(
        request.destination_address,
        BigInt(request.amount),
      );

      const updatedRequest = await bridgeService.findOrThrow(request.id);
      expect(updatedRequest.status).toEqual(
        BridgeRequestStatus.PENDING_DESTINATION_RELEASE_TRANSACTION_CONFIRMATION,
      );
      expect(updatedRequest.destination_transaction).toBeTruthy();

      expect(addJob).toHaveBeenCalledTimes(1);
      expect(addJob.mock.calls[0][0]).toEqual(
        GraphileWorkerPattern.REFRESH_RELEASE_TEST_USDC_TRANSACTION_STATUS,
      );
    });
  });
});
