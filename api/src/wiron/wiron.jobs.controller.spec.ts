/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/. */
import { INestApplication } from '@nestjs/common';
import { BridgeRequestStatus, Chain } from '@prisma/client';
import {
  Block,
  ContractTransactionResponse,
  ethers,
  TransactionReceipt,
} from 'ethers';
import { mock } from 'jest-mock-extended';
import { BridgeService } from '../bridge/bridge.service';
import { WIron, WIron__factory } from '../contracts';
import { TypedContractEvent, TypedEventLog } from '../contracts/common';
import { TransferWithMetadataEvent } from '../contracts/WIron';
import { GraphileWorkerPattern } from '../graphile-worker/enums/graphile-worker-pattern';
import { GraphileWorkerService } from '../graphile-worker/graphile-worker.service';
import { bridgeRequestDTO } from '../test/mocks';
import { bootstrapTestApp } from '../test/test-app';
import { WIronSepoliaHeadService } from '../wiron-sepolia-head/wiron-sepolia-head.service';
import { BurnWIronOptions } from './interfaces/burn-wiron-options';
import { MintWIronOptions } from './interfaces/mint-wiron-options';
import { WIronJobsController } from './wiron.jobs.controller';

describe('MintWIronJobsController', () => {
  let app: INestApplication;
  let bridgeService: BridgeService;
  let graphileWorkerService: GraphileWorkerService;
  let wIronJobsController: WIronJobsController;
  let wIronSepoliaHeadService: WIronSepoliaHeadService;

  beforeAll(async () => {
    app = await bootstrapTestApp();
    bridgeService = app.get(BridgeService);
    graphileWorkerService = app.get(GraphileWorkerService);
    wIronJobsController = app.get(WIronJobsController);
    wIronSepoliaHeadService = app.get(WIronSepoliaHeadService);
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('mint', () => {
    it('calls mint on the WIRON smart contract', async () => {
      const wIronMock = mock<WIron>();

      const amount = '100';
      const destination_address = '0x6637ef23a4378b2c9df51477004c2e2994a2cf4b';
      const request = await bridgeService.upsertRequest(
        bridgeRequestDTO({
          amount,
          destination_address,
          status:
            BridgeRequestStatus.PENDING_DESTINATION_MINT_TRANSACTION_CREATION,
        }),
      );
      jest.spyOn(WIron__factory, 'connect').mockImplementation(() => wIronMock);
      const wIronMint = jest.spyOn(wIronMock, 'mint').mockImplementationOnce(
        () =>
          Promise.resolve({
            hash: 'your_hash_key_value',
          }) as Promise<ContractTransactionResponse>,
      );

      const addJob = jest
        .spyOn(graphileWorkerService, 'addJob')
        .mockImplementation(jest.fn());

      const options: MintWIronOptions = {
        bridgeRequest: request.id,
      };
      await wIronJobsController.mint(options);

      expect(wIronMint).toHaveBeenCalledTimes(1);
      expect(wIronMint).toHaveBeenCalledWith(
        request.destination_address,
        BigInt(request.amount),
      );

      const updatedRequest = await bridgeService.findOrThrow(request.id);
      expect(updatedRequest.status).toEqual(
        BridgeRequestStatus.PENDING_DESTINATION_MINT_TRANSACTION_CONFIRMATION,
      );
      expect(updatedRequest.destination_transaction).toBeTruthy();

      expect(addJob).toHaveBeenCalledTimes(1);
      expect(addJob.mock.calls[0][0]).toEqual(
        GraphileWorkerPattern.REFRESH_MINT_WIRON_TRANSACTION_STATUS,
      );
    });
  });

  describe('refreshTransfers', () => {
    it('updates latest head and saves bridge requests', async () => {
      const upsertRequests = jest.spyOn(bridgeService, 'upsertRequests');
      const updateHead = jest.spyOn(wIronSepoliaHeadService, 'updateHead');
      const addJob = jest
        .spyOn(graphileWorkerService, 'addJob')
        .mockImplementation(jest.fn());

      const wIronMock = mock<WIron>({
        filters: {
          'TransferWithMetadata(address,address,uint256,bytes)':
            mock<
              TypedContractEvent<
                TransferWithMetadataEvent.InputTuple,
                TransferWithMetadataEvent.OutputTuple,
                TransferWithMetadataEvent.OutputObject
              >
            >(),
        },
      });
      const wIronProviderMock = mock<ethers.InfuraProvider>();
      jest
        .spyOn(wIronJobsController, 'connectWIron')
        .mockImplementation(() => ({
          contract: wIronMock,
          provider: wIronProviderMock,
        }));

      const mockHead: Block = {
        number: 4376800,
      } as Block;
      jest
        .spyOn(wIronProviderMock, 'getBlock')
        .mockImplementationOnce(() => Promise.resolve(mockHead));

      const mockToBlock: Block = {
        number: 4376798,
        hash: '0x8f1ca717fb6ebff1ff2835f02349b5b06741d3d38a2df7da28a33d6bf0990230',
      } as Block;
      jest
        .spyOn(wIronProviderMock, 'getBlock')
        .mockImplementationOnce(() => Promise.resolve(mockToBlock));

      const mockEvents = [
        {
          args: [
            '0xfromaddress',
            '0xtoaddress',
            420n,
            'destinationironfishaddress',
          ],
          transactionHash: '0xfoobar',
        },
        {
          args: [
            '0xfromaddress',
            '0xtoaddress',
            69n,
            'destinationironfishaddress',
          ],
          transactionHash: '0xbarbaz',
        },
      ] as TypedEventLog<
        TypedContractEvent<
          TransferWithMetadataEvent.InputTuple,
          TransferWithMetadataEvent.OutputTuple,
          TransferWithMetadataEvent.OutputObject
        >
      >[];
      jest
        .spyOn(wIronMock, 'queryFilter')
        .mockImplementationOnce(() => Promise.resolve(mockEvents));

      await wIronJobsController.refreshTransfers();

      const bridgeRequests = mockEvents.map((event) => {
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

      expect(upsertRequests.mock.calls[0][0]).toEqual(bridgeRequests);
      expect(updateHead.mock.calls[0][0]).toEqual(mockToBlock.hash);
      expect(updateHead.mock.calls[0][1]).toEqual(mockToBlock.number);

      expect(addJob).toHaveBeenCalledTimes(3);
      expect(addJob.mock.calls[0][0]).toBe(GraphileWorkerPattern.BURN_WIRON);
      expect(addJob.mock.calls[1][0]).toBe(GraphileWorkerPattern.BURN_WIRON);
      expect(addJob.mock.calls[2][0]).toBe(
        GraphileWorkerPattern.REFRESH_WIRON_TRANSFERS,
      );
    });
  });

  describe('burn', () => {
    it('calls burn on the WIRON smart contract', async () => {
      const wIronMock = mock<WIron>();
      const wIronProviderMock = mock<ethers.InfuraProvider>();
      jest
        .spyOn(wIronJobsController, 'connectWIron')
        .mockImplementation(() => ({
          contract: wIronMock,
          provider: wIronProviderMock,
        }));

      const amount = '100';
      const destination_address = '0x6637ef23a4378b2c9df51477004c2e2994a2cf4b';
      const request = await bridgeService.upsertRequests([
        bridgeRequestDTO({ amount, destination_address }),
      ]);

      const hash = 'faketransactionhash';
      const wIronBurn = jest.spyOn(wIronMock, 'burn').mockImplementationOnce(
        () =>
          Promise.resolve({
            hash,
          }) as Promise<ContractTransactionResponse>,
      );

      const addJob = jest
        .spyOn(graphileWorkerService, 'addJob')
        .mockImplementation(jest.fn());

      const options: BurnWIronOptions = {
        bridgeRequestId: request[0].id,
        amount: request[0].amount,
      };
      await wIronJobsController.burn(options);

      expect(wIronBurn).toHaveBeenCalledTimes(1);
      expect(wIronBurn).toHaveBeenCalledWith(BigInt(options.amount));

      const updatedRequest = await bridgeService.findOrThrow(request[0].id);
      expect(updatedRequest.status).toEqual(
        BridgeRequestStatus.PENDING_SOURCE_BURN_TRANSACTION_CONFIRMATION,
      );
      expect(updatedRequest.source_burn_transaction).toEqual(hash);

      expect(addJob).toHaveBeenCalledTimes(1);
      expect(addJob.mock.calls[0][0]).toEqual(
        GraphileWorkerPattern.REFRESH_BURN_WIRON_TRANSACTION_STATUS,
      );
    });
  });

  describe('refreshMintWIronTransactionStatus', () => {
    describe('if a transaction is not on a block', () => {
      it('tries again', async () => {
        const wIronMock = mock<WIron>();
        const wIronProviderMock = mock<ethers.InfuraProvider>();
        jest
          .spyOn(wIronJobsController, 'connectWIron')
          .mockImplementation(() => ({
            contract: wIronMock,
            provider: wIronProviderMock,
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
          .spyOn(wIronProviderMock, 'getTransactionReceipt')
          .mockImplementationOnce(() =>
            Promise.resolve(mockTransactionReceipt),
          );

        const { requeue } =
          await wIronJobsController.refreshMintWIronTransactionStatus({
            bridgeRequestId: request.id,
          });

        expect(requeue).toBe(false);
        expect(addJob).toHaveBeenCalledTimes(1);
        expect(addJob.mock.calls[0][0]).toBe(
          GraphileWorkerPattern.REFRESH_MINT_WIRON_TRANSACTION_STATUS,
        );
        expect(addJob.mock.calls[0][1]).toEqual({
          bridgeRequestId: request.id,
        });
      });
    });

    describe('if a transaction is unconfirmed', () => {
      it('tries again', async () => {
        const wIronMock = mock<WIron>();
        const wIronProviderMock = mock<ethers.InfuraProvider>();
        jest
          .spyOn(wIronJobsController, 'connectWIron')
          .mockImplementation(() => ({
            contract: wIronMock,
            provider: wIronProviderMock,
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
          .spyOn(wIronProviderMock, 'getTransactionReceipt')
          .mockImplementationOnce(() =>
            Promise.resolve(mockTransactionReceipt),
          );
        jest
          .spyOn(mockTransactionReceipt, 'confirmations')
          .mockImplementationOnce(() => Promise.resolve(0));

        const { requeue } =
          await wIronJobsController.refreshMintWIronTransactionStatus({
            bridgeRequestId: request.id,
          });

        expect(requeue).toBe(false);
        expect(addJob).toHaveBeenCalledTimes(1);
        expect(addJob.mock.calls[0][0]).toBe(
          GraphileWorkerPattern.REFRESH_MINT_WIRON_TRANSACTION_STATUS,
        );
        expect(addJob.mock.calls[0][1]).toEqual({
          bridgeRequestId: request.id,
        });
      });
    });

    describe('if a transaction is failed', () => {
      it('updates the status to failed', async () => {
        const wIronMock = mock<WIron>();
        const wIronProviderMock = mock<ethers.InfuraProvider>();
        jest
          .spyOn(wIronJobsController, 'connectWIron')
          .mockImplementation(() => ({
            contract: wIronMock,
            provider: wIronProviderMock,
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
          .spyOn(wIronProviderMock, 'getTransactionReceipt')
          .mockImplementationOnce(() =>
            Promise.resolve(mockTransactionReceipt),
          );
        jest
          .spyOn(mockTransactionReceipt, 'confirmations')
          .mockImplementationOnce(() => Promise.resolve(1000));

        const { requeue } =
          await wIronJobsController.refreshMintWIronTransactionStatus({
            bridgeRequestId: request.id,
          });
        expect(requeue).toBe(false);

        const updatedRequest = await bridgeService.findOrThrow(request.id);
        expect(updatedRequest.status).toBe(BridgeRequestStatus.FAILED);
      });
    });

    describe('when the transaction is confirmed', () => {
      it('updates the status to confirmed', async () => {
        const wIronMock = mock<WIron>();
        const wIronProviderMock = mock<ethers.InfuraProvider>();
        jest
          .spyOn(wIronJobsController, 'connectWIron')
          .mockImplementation(() => ({
            contract: wIronMock,
            provider: wIronProviderMock,
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
          .spyOn(wIronProviderMock, 'getTransactionReceipt')
          .mockImplementationOnce(() =>
            Promise.resolve(mockTransactionReceipt),
          );
        jest
          .spyOn(mockTransactionReceipt, 'confirmations')
          .mockImplementationOnce(() => Promise.resolve(1000));

        const { requeue } =
          await wIronJobsController.refreshMintWIronTransactionStatus({
            bridgeRequestId: request.id,
          });
        expect(requeue).toBe(false);

        const updatedRequest = await bridgeService.findOrThrow(request.id);
        expect(updatedRequest.status).toBe(BridgeRequestStatus.CONFIRMED);
      });
    });
  });

  describe('refreshBurnWIronTransactionStatus', () => {
    describe('if a transaction is not on a block', () => {
      it('tries again', async () => {
        const wIronMock = mock<WIron>();
        const wIronProviderMock = mock<ethers.InfuraProvider>();
        jest
          .spyOn(wIronJobsController, 'connectWIron')
          .mockImplementation(() => ({
            contract: wIronMock,
            provider: wIronProviderMock,
          }));

        const amount = '100';
        const destination_address =
          '0x6637ef23a4378b2c9df51477004c2e2994a2cf4b';
        const request = await bridgeService.upsertRequest(
          bridgeRequestDTO({
            amount,
            destination_address,
            status:
              BridgeRequestStatus.PENDING_SOURCE_BURN_TRANSACTION_CONFIRMATION,
            source_burn_transaction: '0xburn',
          }),
        );

        const addJob = jest
          .spyOn(graphileWorkerService, 'addJob')
          .mockImplementation(jest.fn());

        const mockTransactionReceipt: TransactionReceipt = {
          blockHash: null,
        } as unknown as TransactionReceipt;
        jest
          .spyOn(wIronProviderMock, 'getTransactionReceipt')
          .mockImplementationOnce(() =>
            Promise.resolve(mockTransactionReceipt),
          );

        const { requeue } =
          await wIronJobsController.refreshBurnWIronTransactionStatus({
            bridgeRequestId: request.id,
          });

        expect(requeue).toBe(false);
        expect(addJob).toHaveBeenCalledTimes(1);
        expect(addJob.mock.calls[0][0]).toBe(
          GraphileWorkerPattern.REFRESH_BURN_WIRON_TRANSACTION_STATUS,
        );
        expect(addJob.mock.calls[0][1]).toEqual({
          bridgeRequestId: request.id,
        });
      });
    });

    describe('if a transaction is unconfirmed', () => {
      it('tries again', async () => {
        const wIronMock = mock<WIron>();
        const wIronProviderMock = mock<ethers.InfuraProvider>();
        jest
          .spyOn(wIronJobsController, 'connectWIron')
          .mockImplementation(() => ({
            contract: wIronMock,
            provider: wIronProviderMock,
          }));

        const amount = '100';
        const destination_address =
          '0x6637ef23a4378b2c9df51477004c2e2994a2cf4b';
        const request = await bridgeService.upsertRequest(
          bridgeRequestDTO({
            amount,
            destination_address,
            status:
              BridgeRequestStatus.PENDING_SOURCE_BURN_TRANSACTION_CONFIRMATION,
            source_burn_transaction: '0xburn',
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
          .spyOn(wIronProviderMock, 'getTransactionReceipt')
          .mockImplementationOnce(() =>
            Promise.resolve(mockTransactionReceipt),
          );
        jest
          .spyOn(mockTransactionReceipt, 'confirmations')
          .mockImplementationOnce(() => Promise.resolve(0));

        const { requeue } =
          await wIronJobsController.refreshBurnWIronTransactionStatus({
            bridgeRequestId: request.id,
          });

        expect(requeue).toBe(false);
        expect(addJob).toHaveBeenCalledTimes(1);
        expect(addJob.mock.calls[0][0]).toBe(
          GraphileWorkerPattern.REFRESH_BURN_WIRON_TRANSACTION_STATUS,
        );
        expect(addJob.mock.calls[0][1]).toEqual({
          bridgeRequestId: request.id,
        });
      });
    });

    describe('if a transaction is failed', () => {
      it('updates the status to failed', async () => {
        const wIronMock = mock<WIron>();
        const wIronProviderMock = mock<ethers.InfuraProvider>();
        jest
          .spyOn(wIronJobsController, 'connectWIron')
          .mockImplementation(() => ({
            contract: wIronMock,
            provider: wIronProviderMock,
          }));

        const amount = '100';
        const destination_address =
          '0x6637ef23a4378b2c9df51477004c2e2994a2cf4b';
        const request = await bridgeService.upsertRequest(
          bridgeRequestDTO({
            amount,
            destination_address,
            status:
              BridgeRequestStatus.PENDING_SOURCE_BURN_TRANSACTION_CONFIRMATION,
            source_burn_transaction: '0xburn',
          }),
        );

        const mockTransactionReceipt: TransactionReceipt = {
          blockHash: 'blockHash',
          status: 0,
          confirmations: jest.fn(),
        } as unknown as TransactionReceipt;
        jest
          .spyOn(wIronProviderMock, 'getTransactionReceipt')
          .mockImplementationOnce(() =>
            Promise.resolve(mockTransactionReceipt),
          );
        jest
          .spyOn(mockTransactionReceipt, 'confirmations')
          .mockImplementationOnce(() => Promise.resolve(1000));

        const { requeue } =
          await wIronJobsController.refreshBurnWIronTransactionStatus({
            bridgeRequestId: request.id,
          });
        expect(requeue).toBe(false);

        const updatedRequest = await bridgeService.findOrThrow(request.id);
        expect(updatedRequest.status).toBe(BridgeRequestStatus.FAILED);
      });
    });

    describe('when the transaction is confirmed', () => {
      it('updates the status to pending IRON creation', async () => {
        const wIronMock = mock<WIron>();
        const wIronProviderMock = mock<ethers.InfuraProvider>();
        jest
          .spyOn(wIronJobsController, 'connectWIron')
          .mockImplementation(() => ({
            contract: wIronMock,
            provider: wIronProviderMock,
          }));

        const amount = '100';
        const destination_address =
          '0x6637ef23a4378b2c9df51477004c2e2994a2cf4b';
        const request = await bridgeService.upsertRequest(
          bridgeRequestDTO({
            amount,
            destination_address,
            status:
              BridgeRequestStatus.PENDING_SOURCE_BURN_TRANSACTION_CONFIRMATION,
            source_burn_transaction: '0xburn',
          }),
        );

        const mockTransactionReceipt: TransactionReceipt = {
          blockHash: 'blockHash',
          status: 1,
          confirmations: jest.fn(),
        } as unknown as TransactionReceipt;
        jest
          .spyOn(wIronProviderMock, 'getTransactionReceipt')
          .mockImplementationOnce(() =>
            Promise.resolve(mockTransactionReceipt),
          );
        jest
          .spyOn(mockTransactionReceipt, 'confirmations')
          .mockImplementationOnce(() => Promise.resolve(1000));

        const { requeue } =
          await wIronJobsController.refreshBurnWIronTransactionStatus({
            bridgeRequestId: request.id,
          });
        expect(requeue).toBe(false);

        const updatedRequest = await bridgeService.findOrThrow(request.id);
        expect(updatedRequest.status).toBe(
          BridgeRequestStatus.PENDING_DESTINATION_RELEASE_TRANSACTION_CREATION,
        );
      });
    });
  });
});
