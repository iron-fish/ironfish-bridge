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
import { GraphileWorkerService } from '../graphile-worker/graphile-worker.service';
import { PrismaService } from '../prisma/prisma.service';
import { bridgeRequestDTO } from '../test/mocks';
import { bootstrapTestApp } from '../test/test-app';
import { BridgeService } from './bridge.service';
import { BridgeConfirmRequestDTO, BridgeSendRequestDTO } from './types/dto';

describe('AssetsController', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let config: ApiConfigService;
  let bridgeService: BridgeService;
  let graphileWorkerService: GraphileWorkerService;
  let API_KEY: string;
  let IRONFISH_BRIDGE_ADDRESS: string;

  beforeAll(async () => {
    app = await bootstrapTestApp();
    prisma = app.get(PrismaService);
    config = app.get(ApiConfigService);
    bridgeService = app.get(BridgeService);
    graphileWorkerService = app.get(GraphileWorkerService);

    API_KEY = config.get<string>('IRONFISH_BRIDGE_API_KEY');
    IRONFISH_BRIDGE_ADDRESS = config.get<string>('IRONFISH_BRIDGE_ADDRESS');

    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(async () => {
    await prisma.bridgeRequest.deleteMany({});
  });

  describe('POST /bridge/create', () => {
    describe('when data is posted to endpoint', () => {
      it('is successful creates record and returns fk', async () => {
        const source_address = '11111111111111111111111111';
        const data = bridgeRequestDTO({ source_address });
        const { body } = await request(app.getHttpServer())
          .post('/bridge/create')
          .set('Authorization', `Bearer ${API_KEY}`)
          .send({ requests: [data] })
          .expect(HttpStatus.CREATED);

        const entry = await prisma.bridgeRequest.findFirst({
          where: { source_address: { equals: source_address } },
        });
        assert.ok(entry);

        expect(body).toMatchObject({
          [source_address]: entry.id,
        });
      });
    });
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
          .get('/bridge/retrieve')
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

  async function expectedSendFailure(
    send: BridgeSendRequestDTO,
    failureReason: FailureReason,
  ) {
    const response = await request(app.getHttpServer())
      .post('/bridge/send')
      .set('Authorization', `Bearer ${API_KEY}`)
      .send({
        sends: [send],
      })
      .expect(HttpStatus.CREATED);

    expect(response.body).toMatchObject({
      [send.id]: {
        status: BridgeRequestStatus.FAILED,
        failureReason,
      },
    });
  }
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

        const count = await prisma.bridgeHead.count();
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
    describe('failure cases', () => {
      it('nonexistent request id fails', async () => {
        const send: BridgeSendRequestDTO = {
          id: 123132132,
          source_transaction: '123123',
          amount: '100',
          asset: 'asdasfsdafdsafdsa',
          source_address: '11111111111111111111111111',
        };
        await expectedSendFailure(send, FailureReason.REQUEST_NON_EXISTENT);
        expect(true).toBe(true);
      });

      it('invalid status fails', async () => {
        const dto = bridgeRequestDTO({
          status: BridgeRequestStatus.PENDING_PRETRANSFER,
        });
        const bridgeRequest = await bridgeService.upsertRequests([dto]);
        const send: BridgeSendRequestDTO = {
          ...dto,
          source_transaction: dto.source_transaction || '123123',
          id: bridgeRequest[0].id,
        };
        await expectedSendFailure(send, FailureReason.REQUEST_INVALID_STATUS);
        expect(true).toBe(true);
      });

      it('non matching source address fails', async () => {
        const dto = bridgeRequestDTO({});
        const bridgeRequest = await bridgeService.upsertRequests([dto]);
        const send: BridgeSendRequestDTO = {
          ...dto,
          source_transaction: dto.source_transaction || '123123',
          source_address: 'some different address, not the one in db',
          id: bridgeRequest[0].id,
        };
        await expectedSendFailure(
          send,
          FailureReason.REQUEST_SOURCE_ADDRESS_NOT_MATCHING,
        );
        expect(true).toBe(true);
      });

      it('asset id does not match created entry', async () => {
        const dto = bridgeRequestDTO({});
        const bridgeRequest = await bridgeService.upsertRequests([dto]);
        const send: BridgeSendRequestDTO = {
          ...dto,
          source_transaction: dto.source_transaction || '123123',
          asset: 'some different address, not the one in db',
          id: bridgeRequest[0].id,
        };
        await expectedSendFailure(
          send,
          FailureReason.REQUEST_ASSET_NOT_MATCHING,
        );
        expect(true).toBe(true);
      });

      it('amount does not match created entry', async () => {
        const dto = bridgeRequestDTO({});
        const bridgeRequest = await bridgeService.upsertRequests([dto]);
        const send: BridgeSendRequestDTO = {
          ...dto,
          source_transaction: dto.source_transaction || '123123',
          amount: '42069',
          id: bridgeRequest[0].id,
        };
        await expectedSendFailure(
          send,
          FailureReason.REQUEST_AMOUNT_NOT_MATCHING,
        );
        expect(true).toBe(true);
      });
    });

    describe('success case', () => {
      it('updates the request and initiates transfer via smartcontact', async () => {
        const dto = bridgeRequestDTO({});
        const bridgeRequest = await bridgeService.upsertRequests([
          { ...dto, status: BridgeRequestStatus.CREATED },
        ]);

        const addJobMock = jest
          .spyOn(graphileWorkerService, 'addJob')
          .mockImplementationOnce(jest.fn());

        const send: BridgeSendRequestDTO = {
          ...dto,
          source_transaction: dto.source_transaction || '123123',
          id: bridgeRequest[0].id,
        };

        const response = await request(app.getHttpServer())
          .post('/bridge/send')
          .set('Authorization', `Bearer ${API_KEY}`)
          .send({
            sends: [send],
          })
          .expect(HttpStatus.CREATED);

        expect(addJobMock).toHaveBeenCalledTimes(1);
        const updatedRequest = await bridgeService.findByIds([
          bridgeRequest[0].id,
        ]);

        expect(updatedRequest[0].status).toBe(
          BridgeRequestStatus.PENDING_PRETRANSFER,
        );

        expect(response.body).toMatchObject({
          [bridgeRequest[0].id]: {
            status: BridgeRequestStatus.PENDING_PRETRANSFER,
          },
        });
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

  describe('GET /bridge/next_wiron_requests', () => {
    describe('with a missing api key', () => {
      it('returns a 401', async () => {
        const { body } = await request(app.getHttpServer())
          .get('/bridge/next_wiron_requests')
          .expect(HttpStatus.UNAUTHORIZED);

        expect(body).toMatchSnapshot();
      });
    });

    describe('when multiple wiron bridge requests are requested', () => {
      it('returns the records', async () => {
        const mockData = [
          {
            id: 0,
            amount: '0',
            asset: 'IRON',
            source_address: 'source',
            destination_address: 'destination',
            source_transaction: null,
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
          },
          {
            id: 1,
            amount: '1',
            asset: 'IRON',
            source_address: 'source',
            destination_address: 'destination',
            source_transaction: null,
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
          },
        ];
        jest
          .spyOn(bridgeService, 'nextWIronBridgeRequests')
          .mockResolvedValueOnce(mockData);

        const { body } = await request(app.getHttpServer())
          .get('/bridge/next_wiron_requests')
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

  describe('POST /bridge/confirm', () => {
    describe('failure cases', () => {
      it('nonexistent request id fails', async () => {
        const confirm: BridgeConfirmRequestDTO = {
          id: 123132132,
          destination_transaction: '123123',
        };

        const response = await request(app.getHttpServer())
          .post('/bridge/confirm')
          .set('Authorization', `Bearer ${API_KEY}`)
          .send({
            confirms: [confirm],
          })
          .expect(HttpStatus.CREATED);

        expect(response.body).toMatchObject({
          [confirm.id]: {
            status: null,
          },
        });
      });

      it('invalid status fails', async () => {
        const dto = bridgeRequestDTO({
          status: BridgeRequestStatus.PENDING_PRETRANSFER,
        });
        const bridgeRequest = await bridgeService.upsertRequests([dto]);
        const confirm: BridgeConfirmRequestDTO = {
          id: bridgeRequest[0].id,
          destination_transaction: dto.destination_transaction || '123123',
        };

        const response = await request(app.getHttpServer())
          .post('/bridge/confirm')
          .set('Authorization', `Bearer ${API_KEY}`)
          .send({
            confirms: [confirm],
          })
          .expect(HttpStatus.CREATED);

        expect(response.body).toMatchObject({
          [confirm.id]: {
            status: BridgeRequestStatus.PENDING_PRETRANSFER,
          },
        });
      });
    });

    describe('success case', () => {
      it('updates the request status', async () => {
        const dto = bridgeRequestDTO({});
        const bridgeRequest = await bridgeService.upsertRequests([
          { ...dto, status: BridgeRequestStatus.PENDING_ON_DESTINATION_CHAIN },
        ]);

        const confirm: BridgeConfirmRequestDTO = {
          id: bridgeRequest[0].id,
          destination_transaction: dto.destination_transaction || '123123',
        };

        const response = await request(app.getHttpServer())
          .post('/bridge/confirm')
          .set('Authorization', `Bearer ${API_KEY}`)
          .send({
            confirms: [confirm],
          })
          .expect(HttpStatus.CREATED);

        const updatedRequest = await bridgeService.findByIds([
          bridgeRequest[0].id,
        ]);

        expect(updatedRequest[0].status).toBe(BridgeRequestStatus.CONFIRMED);
        expect(updatedRequest[0].destination_transaction).toBe(
          confirm.destination_transaction,
        );

        expect(response.body).toMatchObject({
          [bridgeRequest[0].id]: {
            status: BridgeRequestStatus.CONFIRMED,
          },
        });
      });
    });
  });
});
