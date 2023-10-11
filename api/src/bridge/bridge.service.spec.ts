/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/. */
import { INestApplication } from '@nestjs/common';
import { BridgeRequestStatus, Chain } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { bootstrapTestApp } from '../test/test-app';
import { BridgeService } from './bridge.service';

describe('BridgeService', () => {
  let app: INestApplication;
  let bridgeService: BridgeService;
  let prisma: PrismaService;

  beforeAll(async () => {
    app = await bootstrapTestApp();
    bridgeService = app.get(BridgeService);
    prisma = app.get(PrismaService);
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  describe('nextWIronBridgeRequests', () => {
    describe('when the amount of running BridgeRequests is greater than or equal to requested number', () => {
      it('returns the running BridgeRequests', async () => {
        const runningBridgeRequest1 = {
          id: 0,
          amount: '0',
          asset: 'IRON',
          source_address: 'source',
          destination_address: 'destination',
          source_transaction: 'foo',
          destination_transaction: null,
          source_chain: Chain.ETHEREUM,
          destination_chain: Chain.IRONFISH,
          wiron_burn_transaction: null,
          status: BridgeRequestStatus.PENDING_PRETRANSFER,
          failure_reason: null,
          created_at: new Date(),
          updated_at: new Date(),
          started_at: new Date(),
          completed_at: null,
        };
        const runningBridgeRequest2 = {
          id: 1,
          amount: '1',
          asset: 'IRON',
          source_address: 'source',
          destination_address: 'destination',
          source_transaction: 'bar',
          destination_transaction: null,
          source_chain: Chain.ETHEREUM,
          destination_chain: Chain.IRONFISH,
          wiron_burn_transaction: null,
          status: BridgeRequestStatus.PENDING_PRETRANSFER,
          failure_reason: null,
          created_at: new Date(),
          updated_at: new Date(),
          started_at: new Date(),
          completed_at: null,
        };
        jest
          .spyOn(prisma.bridgeRequest, 'findMany')
          .mockResolvedValueOnce([
            runningBridgeRequest1,
            runningBridgeRequest2,
          ]);

        expect(await bridgeService.nextWIronBridgeRequests(2)).toMatchObject([
          runningBridgeRequest1,
          runningBridgeRequest2,
        ]);
      });
    });

    describe('when the amount of running BridgeRequests is less than requested number', () => {
      it('returns running and pending BridgeRequests', async () => {
        const runningBridgeRequest1 = {
          id: 0,
          amount: '0',
          asset: 'IRON',
          source_address: 'source',
          destination_address: 'destination',
          source_transaction: 'sourcetransaction0',
          destination_transaction: null,
          wiron_burn_transaction: null,
          source_chain: Chain.ETHEREUM,
          destination_chain: Chain.IRONFISH,
          status: BridgeRequestStatus.PENDING_PRETRANSFER,
          failure_reason: null,
          created_at: new Date(),
          updated_at: new Date(),
          started_at: new Date(),
          completed_at: null,
        };
        const runningBridgeRequest2 = {
          id: 1,
          amount: '1',
          asset: 'IRON',
          source_address: 'source',
          destination_address: 'destination',
          source_transaction: 'sourcetransaction2',
          destination_transaction: null,
          wiron_burn_transaction: null,
          source_chain: Chain.ETHEREUM,
          destination_chain: Chain.IRONFISH,
          status: BridgeRequestStatus.PENDING_PRETRANSFER,
          failure_reason: null,
          created_at: new Date(),
          updated_at: new Date(),
          started_at: new Date(),
          completed_at: null,
        };
        const pendingBridgeRequest = {
          id: 2,
          amount: '1',
          asset: 'IRON',
          source_address: 'source',
          destination_address: 'destination',
          source_transaction: 'source_transaction1',
          destination_transaction: null,
          wiron_burn_transaction: null,
          source_chain: Chain.ETHEREUM,
          destination_chain: Chain.IRONFISH,
          status: BridgeRequestStatus.CREATED,
          failure_reason: null,
          created_at: new Date(),
          updated_at: new Date(),
          started_at: null,
          completed_at: null,
        };
        jest
          .spyOn(prisma.bridgeRequest, 'findMany')
          .mockResolvedValueOnce([runningBridgeRequest1, runningBridgeRequest2])
          .mockResolvedValueOnce([pendingBridgeRequest]);

        expect(await bridgeService.nextWIronBridgeRequests(3)).toMatchObject([
          runningBridgeRequest1,
          runningBridgeRequest2,
        ]);
      });
    });
  });
});
