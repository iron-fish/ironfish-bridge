/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/. */
import { INestApplication } from '@nestjs/common';
import { BridgeRequestStatus } from '@prisma/client';
import { ContractTransactionResponse } from 'ethers';
import { mock } from 'jest-mock-extended';
import { BridgeService } from '../bridge/bridge.service';
import { WIron, WIron__factory } from '../contracts';
import { bridgeRequestDTO } from '../test/mocks';
import { bootstrapTestApp } from '../test/test-app';
import { MintWIronOptions } from './interfaces/mint-wiron-options';
import { WIronJobsController } from './wiron.jobs.controller';

describe('MintWIronJobsController', () => {
  let app: INestApplication;
  let wIronJobsController: WIronJobsController;
  let bridgeService: BridgeService;

  beforeAll(async () => {
    app = await bootstrapTestApp();
    wIronJobsController = app.get(WIronJobsController);
    bridgeService = app.get(BridgeService);
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
      const request = await bridgeService.upsertRequests([
        bridgeRequestDTO({ amount, destination_address }),
      ]);
      jest.spyOn(WIron__factory, 'connect').mockImplementation(() => wIronMock);
      const wIronMint = jest.spyOn(wIronMock, 'mint').mockImplementationOnce(
        () =>
          Promise.resolve({
            hash: 'your_hash_key_value',
          }) as Promise<ContractTransactionResponse>,
      );

      const options: MintWIronOptions = {
        bridgeRequest: request[0].id,
        destination: request[0].destination_address,
        amount: BigInt(request[0].amount),
      };
      await wIronJobsController.mint(options);

      expect(wIronMint).toHaveBeenCalledTimes(1);
      expect(wIronMint).toHaveBeenCalledWith(
        options.destination,
        options.amount,
      );

      const updatedRequest = await bridgeService.findByIds([request[0].id]);
      expect(updatedRequest[0].status).toEqual(
        BridgeRequestStatus.PENDING_ON_DESTINATION_CHAIN,
      );
      expect(updatedRequest[0].destination_transaction).toBeTruthy();
    });
  });

  describe.only('refreshTransfers', () => {
    it('polls for latest transfers', async () => {
      await wIronJobsController.refreshTransfers();
    });
  });
});
