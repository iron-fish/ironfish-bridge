/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/. */
import { INestApplication } from '@nestjs/common';
import { BridgeRequestStatus } from '@prisma/client';
import { ethers } from 'ethers';
import { mock } from 'jest-mock-extended';
import { AssetSepoliaHeadService } from '../asset-sepolia-head/asset-sepolia-head.service';
import { BridgeService } from '../bridge/bridge.service';
import { WIron } from '../contracts';
import { TypedContractEvent, TypedEventLog } from '../contracts/common';
import { TransferWithMetadataEvent } from '../contracts/WIron';
import { GraphileWorkerPattern } from '../graphile-worker/enums/graphile-worker-pattern';
import { GraphileWorkerService } from '../graphile-worker/graphile-worker.service';
import { bootstrapTestApp } from '../test/test-app';
import { AssetJobsController } from './asset.jobs.controller';

describe('MintWIronJobsController', () => {
  let app: INestApplication;
  let bridgeService: BridgeService;
  let graphileWorkerService: GraphileWorkerService;
  let assetJobsController: AssetJobsController;
  let assetSepoliaHeadService: AssetSepoliaHeadService;

  beforeAll(async () => {
    app = await bootstrapTestApp();
    bridgeService = app.get(BridgeService);
    graphileWorkerService = app.get(GraphileWorkerService);
    assetJobsController = app.get(AssetJobsController);
    assetSepoliaHeadService = app.get(AssetSepoliaHeadService);
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('refreshTransfers', () => {
    it('creates bridge request from ethereum deposits', async () => {
      const wIronMock = mock<WIron>();
      const wIronProviderMock = mock<ethers.InfuraProvider>();
      jest
        .spyOn(assetJobsController, 'connectEthereum')
        .mockImplementation(() => ({
          contract: wIronMock,
          provider: wIronProviderMock,
        }));

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
      const addJob = jest
        .spyOn(graphileWorkerService, 'addJob')
        .mockImplementation(jest.fn());

      const options: BurnWIronOptions = {
        bridgeRequestId: request[0].id,
        amount: request[0].amount,
      };
      await assetJobsController.burn(options);

      expect(wIronBurn).toHaveBeenCalledTimes(1);
      expect(wIronBurn).toHaveBeenCalledWith(options.amount);

      const updatedRequest = await bridgeService.findOrThrow(request[0].id);
      expect(updatedRequest.status).toEqual(
        BridgeRequestStatus.PENDING_WIRON_BURN_TRANSACTION_CONFIRMATION,
      );
      expect(updatedRequest.wiron_burn_transaction).toEqual(hash);

      expect(addJob).toHaveBeenCalledTimes(1);
      expect(addJob.mock.calls[0][0]).toEqual(
        GraphileWorkerPattern.REFRESH_BURN_WIRON_TRANSACTION_STATUS,
      );
    });
  });
});
