/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/. */
import {
  afterAll,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
} from '@jest/globals';
import { HttpStatus, INestApplication } from '@nestjs/common';
import { BridgeRequestStatus, Chain, FailureReason } from '@prisma/client';
import assert from 'assert';
import request from 'supertest';
import { ApiConfigService } from '../api-config/api-config.service';
import { IRON_ASSET_ID } from '../common/constants';
import { GraphileWorkerService } from '../graphile-worker/graphile-worker.service';
import { PrismaService } from '../prisma/prisma.service';
import { bridgeRequestDTO } from '../test/mocks';
import { bootstrapTestApp } from '../test/test-app';
import { BridgeController } from './bridge.controller';
import { BridgeService } from './bridge.service';
import { BridgeSendRequestDTO, UpdateRequestDTO } from './types/dto';

describe('BridgeController', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let config: ApiConfigService;
  let bridgeService: BridgeService;
  let bridgeController: BridgeController;
  let graphileWorkerService: GraphileWorkerService;
  let API_KEY: string;
  let IRONFISH_BRIDGE_ADDRESS: string;

  beforeAll(async () => {
    app = await bootstrapTestApp();
    prisma = app.get(PrismaService);
    config = app.get(ApiConfigService);
    bridgeService = app.get(BridgeService);
    graphileWorkerService = app.get(GraphileWorkerService);
    bridgeController = app.get(BridgeController);

    API_KEY = config.get<string>('IRONFISH_BRIDGE_API_KEY');
    IRONFISH_BRIDGE_ADDRESS = config.get<string>('IRONFISH_BRIDGE_ADDRESS');

    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  beforeEach(async () => {
    await prisma.bridgeRequest.deleteMany({});
  });

  describe('POST /bridge/retrieve', () => {
    describe('when data is requested by id', () => {
      it('is successfully returns if fk is in db, null if not', async () => {
        const unsavedId = 1234567;
        const requestData = bridgeRequestDTO({});
        const foo = await prisma.bridgeRequest.create({
          data: requestData,
        });
        const { body } = await request(app.getHttpServer())
          .post('/bridge/retrieve')
          .set('Authorization', `Bearer ${API_KEY}`)
          .send({ ids: [foo.id, unsavedId] })
          .expect(HttpStatus.OK);

        expect(body).toMatchObject({
          [foo.id]: {
            ...requestData,
          },
          [unsavedId]: null,
        });
      });
    });
  });

  describe('POST /bridge/head', () => {
    describe('updates or creates head for tracking sync progress', () => {
      it('creates then updates head', async () => {
        await request(app.getHttpServer())
          .post('/bridge/head')
          .set('Authorization', `Bearer ${API_KEY}`)
          .send({ head: 'fakehash1' })
          .expect(HttpStatus.CREATED);

        const { body } = await request(app.getHttpServer())
          .post('/bridge/head')
          .set('Authorization', `Bearer ${API_KEY}`)
          .send({ head: 'fakehash2' })
          .expect(HttpStatus.CREATED);

        expect(body).toEqual({
          hash: 'fakehash2',
        });

        const count = await prisma.ironFishTestnetHead.count();
        expect(count).toBe(1);

        const { body: getBody } = await request(app.getHttpServer())
          .get('/bridge/head')
          .set('Authorization', `Bearer ${API_KEY}`)
          .expect(HttpStatus.OK);

        expect(getBody.hash).toBe('fakehash2');
      });
    });
  });

  describe('POST /bridge/send', () => {
    it('updates the request and initiates transfer via smartcontact', async () => {
      const dto = bridgeRequestDTO({});

      const addJobMock = jest
        .spyOn(graphileWorkerService, 'addJob')
        .mockImplementationOnce(jest.fn());

      const send: BridgeSendRequestDTO = {
        ...dto,
        source_transaction: dto.source_transaction,
      };

      const response = await request(app.getHttpServer())
        .post('/bridge/send')
        .set('Authorization', `Bearer ${API_KEY}`)
        .send({
          sends: [send],
        })
        .expect(HttpStatus.CREATED);

      expect(addJobMock).toHaveBeenCalledTimes(1);

      const bridgeRequest = await bridgeService.findBySourceTransaction(
        dto.source_transaction,
      );
      assert.ok(bridgeRequest);
      expect(bridgeRequest.status).toBe(
        BridgeRequestStatus.PENDING_DESTINATION_MINT_TRANSACTION_CREATION,
      );

      expect(response.body).toMatchObject({
        [bridgeRequest.id]: {
          status:
            BridgeRequestStatus.PENDING_DESTINATION_MINT_TRANSACTION_CREATION,
        },
      });
    });
  });

  describe('POST /bridge/release', () => {
    it('marks the release for confirmation', async () => {
      const dto = bridgeRequestDTO({});

      const addJobMock = jest
        .spyOn(graphileWorkerService, 'addJob')
        .mockImplementationOnce(jest.fn());

      const response = await request(app.getHttpServer())
        .post('/bridge/release')
        .set('Authorization', `Bearer ${API_KEY}`)
        .send({
          releases: [dto],
        })
        .expect(HttpStatus.CREATED);

      expect(addJobMock).toHaveBeenCalledTimes(1);

      const bridgeRequest = await bridgeService.findBySourceTransaction(
        dto.source_transaction,
      );
      assert.ok(bridgeRequest);
      expect(bridgeRequest.status).toBe(
        BridgeRequestStatus.PENDING_DESTINATION_RELEASE_TRANSACTION_CREATION,
      );

      expect(response.body).toMatchObject({
        [bridgeRequest.id]: {
          status:
            BridgeRequestStatus.PENDING_DESTINATION_RELEASE_TRANSACTION_CREATION,
        },
      });
    });
  });

  describe('GET /bridge/address', () => {
    it('returns the configured public Iron Fish address of the bridge', async () => {
      const { body } = await request(app.getHttpServer())
        .get('/bridge/address')
        .expect(HttpStatus.OK);

      expect(body.address).toEqual(IRONFISH_BRIDGE_ADDRESS);
    });
  });

  describe('GET /bridge/next_release_requests', () => {
    describe('with a missing api key', () => {
      it('returns a 401', async () => {
        const { body } = await request(app.getHttpServer())
          .get('/bridge/next_release_requests')
          .expect(HttpStatus.UNAUTHORIZED);

        expect(body).toMatchSnapshot();
      });
    });

    describe('when multiple release bridge requests are requested', () => {
      it('returns the records', async () => {
        const mockData = [
          {
            id: 0,
            amount: '0',
            asset: IRON_ASSET_ID,
            source_address: 'source',
            destination_address: 'destination',
            source_transaction: 'source_transaction0',
            destination_transaction: null,
            source_burn_transaction: null,
            source_chain: Chain.ETHEREUM,
            destination_chain: Chain.IRONFISH,
            status: BridgeRequestStatus.PENDING_PRETRANSFER,
            failure_reason: null,
            created_at: new Date(),
            updated_at: new Date(),
            started_at: new Date(),
            completed_at: null,
          },
          {
            id: 1,
            amount: '1',
            asset: IRON_ASSET_ID,
            source_address: 'source',
            destination_address: 'destination',
            source_transaction: 'source_transaction',
            destination_transaction: null,
            source_burn_transaction: null,
            source_chain: Chain.ETHEREUM,
            destination_chain: Chain.IRONFISH,
            status: BridgeRequestStatus.PENDING_PRETRANSFER,
            failure_reason: null,
            created_at: new Date(),
            updated_at: new Date(),
            started_at: new Date(),
            completed_at: null,
          },
        ];
        jest
          .spyOn(bridgeService, 'nextReleaseBridgeRequests')
          .mockResolvedValueOnce(mockData);

        const { body } = await request(app.getHttpServer())
          .get('/bridge/next_release_requests')
          .set('Authorization', `Bearer ${API_KEY}`)
          .query({ count: 2 })
          .expect(HttpStatus.OK);

        const { data } = body;
        expect(data as unknown[]).toMatchObject([
          {
            id: mockData[0].id,
            amount: mockData[0].amount,
            asset: mockData[0].asset,
            source_address: mockData[0].source_address,
            destination_address: mockData[0].destination_address,
            source_transaction: mockData[0].source_transaction,
            destination_transaction: mockData[0].destination_transaction,
            source_chain: mockData[0].source_chain,
            destination_chain: mockData[0].destination_chain,
            status: mockData[0].status,
          },
          {
            id: mockData[1].id,
            amount: mockData[1].amount,
            asset: mockData[1].asset,
            source_address: mockData[1].source_address,
            destination_address: mockData[1].destination_address,
            source_transaction: mockData[1].source_transaction,
            destination_transaction: mockData[1].destination_transaction,
            source_chain: mockData[1].source_chain,
            destination_chain: mockData[1].destination_chain,
            status: mockData[1].status,
          },
        ]);
      });
    });
  });

  describe('GET /bridge/next_burn_requests', () => {
    describe('with a missing api key', () => {
      it('returns a 401', async () => {
        const { body } = await request(app.getHttpServer())
          .get('/bridge/next_release_requests')
          .expect(HttpStatus.UNAUTHORIZED);

        expect(body).toMatchSnapshot();
      });
    });

    describe('when multiple burn requests are requested', () => {
      it('returns the records', async () => {
        const mockData = [
          {
            id: 0,
            amount: '0',
            asset: IRON_ASSET_ID,
            source_address: 'source',
            destination_address: 'destination',
            source_transaction: 'source_transaction0',
            destination_transaction: null,
            source_burn_transaction: null,
            source_chain: Chain.IRONFISH,
            destination_chain: Chain.ETHEREUM,
            status:
              BridgeRequestStatus.PENDING_SOURCE_BURN_TRANSACTION_CREATION,
            failure_reason: null,
            created_at: new Date(),
            updated_at: new Date(),
            started_at: new Date(),
            completed_at: null,
          },
          {
            id: 1,
            amount: '1',
            asset: IRON_ASSET_ID,
            source_address: 'source',
            destination_address: 'destination',
            source_transaction: 'source_transaction',
            destination_transaction: null,
            source_burn_transaction: null,
            source_chain: Chain.ETHEREUM,
            destination_chain: Chain.IRONFISH,
            status:
              BridgeRequestStatus.PENDING_SOURCE_BURN_TRANSACTION_CREATION,
            failure_reason: null,
            created_at: new Date(),
            updated_at: new Date(),
            started_at: new Date(),
            completed_at: null,
          },
        ];
        jest
          .spyOn(bridgeService, 'nextBurnBridgeRequests')
          .mockResolvedValueOnce(mockData);

        const { body } = await request(app.getHttpServer())
          .get('/bridge/next_burn_requests')
          .set('Authorization', `Bearer ${API_KEY}`)
          .query({ count: 2 })
          .expect(HttpStatus.OK);

        const { data } = body;
        expect(data as unknown[]).toMatchObject([
          {
            id: mockData[0].id,
            amount: mockData[0].amount,
            asset: mockData[0].asset,
            source_address: mockData[0].source_address,
            destination_address: mockData[0].destination_address,
            source_transaction: mockData[0].source_transaction,
            destination_transaction: mockData[0].destination_transaction,
            source_chain: mockData[0].source_chain,
            destination_chain: mockData[0].destination_chain,
            status: mockData[0].status,
          },
          {
            id: mockData[1].id,
            amount: mockData[1].amount,
            asset: mockData[1].asset,
            source_address: mockData[1].source_address,
            destination_address: mockData[1].destination_address,
            source_transaction: mockData[1].source_transaction,
            destination_transaction: mockData[1].destination_transaction,
            source_chain: mockData[1].source_chain,
            destination_chain: mockData[1].destination_chain,
            status: mockData[1].status,
          },
        ]);
      });
    });
  });

  describe('POST /bridge/update_requests', () => {
    describe('failure cases', () => {
      it('nonexistent request id fails', async () => {
        const transaction: UpdateRequestDTO = {
          id: 123132132,
          destination_transaction: '123123',
          status:
            BridgeRequestStatus.PENDING_DESTINATION_RELEASE_TRANSACTION_CREATION,
        };

        const response = await request(app.getHttpServer())
          .post('/bridge/update_requests')
          .set('Authorization', `Bearer ${API_KEY}`)
          .send({
            transactions: [transaction],
          })
          .expect(HttpStatus.CREATED);

        expect(response.body).toMatchObject({
          [transaction.id]: {
            status: null,
          },
        });
      });
    });

    describe('success case', () => {
      it('updates the request status', async () => {
        const dto = bridgeRequestDTO({});
        const bridgeRequest = await bridgeService.upsertRequests([
          {
            ...dto,
            status:
              BridgeRequestStatus.PENDING_DESTINATION_RELEASE_TRANSACTION_CREATION,
          },
        ]);

        const transaction: UpdateRequestDTO = {
          id: bridgeRequest[0].id,
          destination_transaction: dto.destination_transaction || '123123',
          status: BridgeRequestStatus.PENDING_ON_DESTINATION_CHAIN,
        };

        const response = await request(app.getHttpServer())
          .post('/bridge/update_requests')
          .set('Authorization', `Bearer ${API_KEY}`)
          .send({
            transactions: [transaction],
          })
          .expect(HttpStatus.CREATED);

        const updatedRequest = await bridgeService.findByIds([
          bridgeRequest[0].id,
        ]);

        expect(updatedRequest[0].status).toBe(
          BridgeRequestStatus.PENDING_ON_DESTINATION_CHAIN,
        );
        expect(updatedRequest[0].destination_transaction).toBe(
          transaction.destination_transaction,
        );

        expect(response.body).toMatchObject({
          [bridgeRequest[0].id]: {
            status: BridgeRequestStatus.PENDING_ON_DESTINATION_CHAIN,
          },
        });
      });
    });
  });

  describe('upsertBridgeSendRequestDTOs', () => {
    it('creates records, but records failure on invalid asset', async () => {
      const dto = bridgeRequestDTO({
        asset: 'invalid asset',
        status:
          BridgeRequestStatus.PENDING_DESTINATION_RELEASE_TRANSACTION_CREATION,
      });

      const response = await bridgeController.upsertBridgeSendRequestDTOs(
        [dto],
        BridgeRequestStatus.PENDING_DESTINATION_RELEASE_TRANSACTION_CREATION,
      );
      const id = Object.keys(response)[0];

      expect(response).toHaveProperty(id, {
        status: BridgeRequestStatus.FAILED,
        failureReason: FailureReason.REQUEST_ASSET_NOT_MATCHING,
      });

      const failed = await prisma.failedBridgeRequest.findFirst({
        where: { bridge_request_id: Number(id) },
      });
      expect(failed).toMatchObject({
        bridge_request_id: Number(id),
        error: expect.any(String),
        failure_reason: FailureReason.REQUEST_ASSET_NOT_MATCHING,
      });
    });
  });
});
