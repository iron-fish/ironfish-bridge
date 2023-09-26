/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/. */
import { INestApplication } from '@nestjs/common';
import { mock } from 'jest-mock-extended';
import { WIron, WIron__factory } from '../contracts';
import { bootstrapTestApp } from '../test/test-app';
import { MintWIronOptions } from './interfaces/mint-wiron-options';
import { WIronJobsController } from './wiron.jobs.controller';

describe('MintWIronJobsController', () => {
  let app: INestApplication;
  let wIronJobsController: WIronJobsController;

  beforeAll(async () => {
    app = await bootstrapTestApp();
    wIronJobsController = app.get(WIronJobsController);
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

      jest.spyOn(WIron__factory, 'connect').mockImplementation(() => wIronMock);
      const wIronMint = jest
        .spyOn(wIronMock, 'mint')
        .mockImplementationOnce(jest.fn());

      const options: MintWIronOptions = {
        destination: '0x6637ef23a4378b2c9df51477004c2e2994a2cf4b',
        amount: 42069n,
      };
      await wIronJobsController.mint(options);

      expect(wIronMint).toHaveBeenCalledTimes(1);
      expect(wIronMint).toHaveBeenCalledWith(
        options.destination,
        options.amount,
      );
    });
  });
});
