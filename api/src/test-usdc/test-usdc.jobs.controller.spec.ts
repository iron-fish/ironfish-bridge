/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/. */
import { INestApplication } from '@nestjs/common';
import { BridgeRequestStatus } from '@prisma/client';
import {
  ContractTransactionResponse,
  ethers,
  TransactionReceipt,
} from 'ethers';
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

  describe('refreshReleaseTestUSDCTransactionStatus', () => {
    describe('if a transaction is not on a block', () => {
      it('tries again', async () => {
        const testUSDCMock = mock<TestUSDC>();
        const testUSDCProviderMock = mock<ethers.InfuraProvider>();
        jest
          .spyOn(testUSDCJobsController, 'connectTestUSDC')
          .mockImplementation(() => ({
            contract: testUSDCMock,
            provider: testUSDCProviderMock,
          }));

        const amount = '100';
        const destination_address =
          '0x6637ef23a4378b2c9df51477004c2e2994a2cf4b';
        const request = await bridgeService.upsertRequest(
          bridgeRequestDTO({
            amount,
            destination_address,
            status: BridgeRequestStatus.CREATED,
            destination_transaction: '0xmint',
          }),
        );

        const addJob = jest
          .spyOn(graphileWorkerService, 'addJob')
          .mockImplementation(jest.fn());

        const mockTransactionReceipt: TransactionReceipt = {
          blockHash: null,
        } as unknown as TransactionReceipt;
        jest
          .spyOn(testUSDCProviderMock, 'getTransactionReceipt')
          .mockImplementationOnce(() =>
            Promise.resolve(mockTransactionReceipt),
          );

        const { requeue } =
          await testUSDCJobsController.refreshReleaseTestUSDCTransactionStatus({
            bridgeRequestId: request.id,
          });

        expect(requeue).toBe(false);
        expect(addJob).toHaveBeenCalledTimes(1);
        expect(addJob.mock.calls[0][0]).toBe(
          GraphileWorkerPattern.REFRESH_RELEASE_TEST_USDC_TRANSACTION_STATUS,
        );
        expect(addJob.mock.calls[0][1]).toEqual({
          bridgeRequestId: request.id,
        });
      });
    });

    describe('if a transaction is unconfirmed', () => {
      it('tries again', async () => {
        const testUSDCMock = mock<TestUSDC>();
        const testUSDCProviderMock = mock<ethers.InfuraProvider>();
        jest
          .spyOn(testUSDCJobsController, 'connectTestUSDC')
          .mockImplementation(() => ({
            contract: testUSDCMock,
            provider: testUSDCProviderMock,
          }));

        const amount = '100';
        const destination_address =
          '0x6637ef23a4378b2c9df51477004c2e2994a2cf4b';
        const request = await bridgeService.upsertRequest(
          bridgeRequestDTO({
            amount,
            destination_address,
            status: BridgeRequestStatus.CREATED,
            destination_transaction: '0xmint',
          }),
        );

        const addJob = jest
          .spyOn(graphileWorkerService, 'addJob')
          .mockImplementation(jest.fn());

        const mockTransactionReceipt: TransactionReceipt = {
          blockHash: 'blockHash',
          confirmations: jest.fn(),
        } as unknown as TransactionReceipt;
        jest
          .spyOn(testUSDCProviderMock, 'getTransactionReceipt')
          .mockImplementationOnce(() =>
            Promise.resolve(mockTransactionReceipt),
          );
        jest
          .spyOn(mockTransactionReceipt, 'confirmations')
          .mockImplementationOnce(() => Promise.resolve(0));

        const { requeue } =
          await testUSDCJobsController.refreshReleaseTestUSDCTransactionStatus({
            bridgeRequestId: request.id,
          });

        expect(requeue).toBe(false);
        expect(addJob).toHaveBeenCalledTimes(1);
        expect(addJob.mock.calls[0][0]).toBe(
          GraphileWorkerPattern.REFRESH_RELEASE_TEST_USDC_TRANSACTION_STATUS,
        );
        expect(addJob.mock.calls[0][1]).toEqual({
          bridgeRequestId: request.id,
        });
      });
    });

    describe('if a transaction is failed', () => {
      it('updates the status to failed', async () => {
        const testUSDCMock = mock<TestUSDC>();
        const testUSDCProviderMock = mock<ethers.InfuraProvider>();
        jest
          .spyOn(testUSDCJobsController, 'connectTestUSDC')
          .mockImplementation(() => ({
            contract: testUSDCMock,
            provider: testUSDCProviderMock,
          }));

        const amount = '100';
        const destination_address =
          '0x6637ef23a4378b2c9df51477004c2e2994a2cf4b';
        const request = await bridgeService.upsertRequest(
          bridgeRequestDTO({
            amount,
            destination_address,
            status: BridgeRequestStatus.CREATED,
            destination_transaction: '0xmint',
          }),
        );

        const mockTransactionReceipt: TransactionReceipt = {
          blockHash: 'blockHash',
          status: 0,
          confirmations: jest.fn(),
        } as unknown as TransactionReceipt;
        jest
          .spyOn(testUSDCProviderMock, 'getTransactionReceipt')
          .mockImplementationOnce(() =>
            Promise.resolve(mockTransactionReceipt),
          );
        jest
          .spyOn(mockTransactionReceipt, 'confirmations')
          .mockImplementationOnce(() => Promise.resolve(1000));

        const { requeue } =
          await testUSDCJobsController.refreshReleaseTestUSDCTransactionStatus({
            bridgeRequestId: request.id,
          });
        expect(requeue).toBe(false);

        const updatedRequest = await bridgeService.findOrThrow(request.id);
        expect(updatedRequest.status).toBe(BridgeRequestStatus.FAILED);
      });
    });

    describe('when the transaction is confirmed', () => {
      it('updates the status to confirmed', async () => {
        const testUSDCMock = mock<TestUSDC>();
        const testUSDCProviderMock = mock<ethers.InfuraProvider>();
        jest
          .spyOn(testUSDCJobsController, 'connectTestUSDC')
          .mockImplementation(() => ({
            contract: testUSDCMock,
            provider: testUSDCProviderMock,
          }));

        const amount = '100';
        const destination_address =
          '0x6637ef23a4378b2c9df51477004c2e2994a2cf4b';
        const request = await bridgeService.upsertRequest(
          bridgeRequestDTO({
            amount,
            destination_address,
            status: BridgeRequestStatus.CREATED,
            destination_transaction: '0xmint',
          }),
        );

        const mockTransactionReceipt: TransactionReceipt = {
          blockHash: 'blockHash',
          status: 1,
          confirmations: jest.fn(),
        } as unknown as TransactionReceipt;
        jest
          .spyOn(testUSDCProviderMock, 'getTransactionReceipt')
          .mockImplementationOnce(() =>
            Promise.resolve(mockTransactionReceipt),
          );
        jest
          .spyOn(mockTransactionReceipt, 'confirmations')
          .mockImplementationOnce(() => Promise.resolve(1000));

        const { requeue } =
          await testUSDCJobsController.refreshReleaseTestUSDCTransactionStatus({
            bridgeRequestId: request.id,
          });
        expect(requeue).toBe(false);

        const updatedRequest = await bridgeService.findOrThrow(request.id);
        expect(updatedRequest.status).toBe(BridgeRequestStatus.CONFIRMED);
      });
    });
  });
});
