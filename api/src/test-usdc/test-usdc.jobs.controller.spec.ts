/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/. */
import { INestApplication } from '@nestjs/common';
import { BridgeRequestStatus, Chain } from '@prisma/client';
import { Block, ethers } from 'ethers';
import { mock } from 'jest-mock-extended';
import { BridgeService } from '../bridge/bridge.service';
import { TestUSDC } from '../contracts';
import { TypedContractEvent, TypedEventLog } from '../contracts/common';
import { TransferWithMetadataEvent } from '../contracts/WIron';
import { GraphileWorkerPattern } from '../graphile-worker/enums/graphile-worker-pattern';
import { GraphileWorkerService } from '../graphile-worker/graphile-worker.service';
import { SepoliaHeadsService } from '../sepolia-heads/sepolia-heads.service';
import { bootstrapTestApp } from '../test/test-app';
import { TestUsdcJobsController } from './test-usdc.jobs.controller';

describe('TestUsdcJobsController', () => {
  let app: INestApplication;
  let bridgeService: BridgeService;
  let graphileWorkerService: GraphileWorkerService;
  let sepoliaHeadsService: SepoliaHeadsService;
  let testUsdcJobsController: TestUsdcJobsController;

  beforeAll(async () => {
    app = await bootstrapTestApp();
    bridgeService = app.get(BridgeService);
    graphileWorkerService = app.get(GraphileWorkerService);
    sepoliaHeadsService = app.get(SepoliaHeadsService);
    testUsdcJobsController = app.get(TestUsdcJobsController);
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('refreshTransfers', () => {
    it('updates latest head and saves bridge requests', async () => {
      const upsertRequests = jest.spyOn(bridgeService, 'upsertRequests');
      const updateHead = jest.spyOn(sepoliaHeadsService, 'updateTestUsdcHead');
      const addJob = jest
        .spyOn(graphileWorkerService, 'addJob')
        .mockImplementation(jest.fn());

      const testUsdcMock = mock<TestUSDC>({
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
      const testUsdcProviderMock = mock<ethers.InfuraProvider>();
      jest
        .spyOn(testUsdcJobsController, 'connectTestUsdc')
        .mockImplementation(() => ({
          contract: testUsdcMock,
          provider: testUsdcProviderMock,
        }));

      const mockHead: Block = {
        number: 4502827,
      } as Block;
      jest
        .spyOn(testUsdcProviderMock, 'getBlock')
        .mockImplementationOnce(() => Promise.resolve(mockHead));

      const mockToBlock: Block = {
        number: 4502799,
        hash: '0x3b35533261d188f8efd2601b2b7955b826dbcc0282d74d905d6e7a8d7464d577',
      } as Block;
      jest
        .spyOn(testUsdcProviderMock, 'getBlock')
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
        .spyOn(testUsdcMock, 'queryFilter')
        .mockImplementationOnce(() => Promise.resolve(mockEvents));

      await testUsdcJobsController.refreshTransfers();

      const bridgeRequests = mockEvents.map((event) => {
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

      expect(upsertRequests.mock.calls[0][0]).toEqual(bridgeRequests);
      expect(updateHead.mock.calls[0][0]).toEqual(mockToBlock.hash);
      expect(updateHead.mock.calls[0][1]).toEqual(mockToBlock.number);

      expect(addJob).toHaveBeenCalledTimes(1);
      expect(addJob.mock.calls[0][0]).toBe(
        GraphileWorkerPattern.REFRESH_TEST_USDC_TRANSFERS,
      );
    });
  });
});
