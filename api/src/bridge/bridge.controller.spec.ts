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
import { BridgeRequestStatus } from '@prisma/client';
import assert from 'assert';
import request from 'supertest';
import { ApiConfigService } from '../api-config/api-config.service';
import { GraphileWorkerService } from '../graphile-worker/graphile-worker.service';
import { PrismaService } from '../prisma/prisma.service';
import { bridgeRequestDTO } from '../test/mocks';
import { bootstrapTestApp } from '../test/test-app';
import { BridgeService } from './bridge.service';

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
    it('updates the request and initiates transfer via smartcontact', async () => {
      const data = bridgeRequestDTO({});
      const bridgeRequest = await bridgeService.upsertRequests([
        {
          ...data,
          source_transaction: '123123',
          status: BridgeRequestStatus.CREATED,
        },
      ]);
      const bridgeRequestCompleted = await bridgeService.upsertRequests([
        {
          ...data,
          source_transaction: '11111',
          status: BridgeRequestStatus.CONFIRMED,
        },
      ]);
      const nonExistentId = 1234567;

      const addJobMock = jest
        .spyOn(graphileWorkerService, 'addJob')
        .mockImplementationOnce(jest.fn());

      const response = await request(app.getHttpServer())
        .post('/bridge/send')
        .set('Authorization', `Bearer ${API_KEY}`)
        .send({
          sends: [
            {
              id: bridgeRequest[0].id,
              source_transaction: bridgeRequest[0].source_transaction,
            },
            {
              id: bridgeRequestCompleted[0].id,
              source_transaction: bridgeRequestCompleted[0].source_transaction,
            },
            { id: nonExistentId, source_transaction: '1212121' },
          ],
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
        [bridgeRequestCompleted[0].id]: {
          status: null,
          failureReason: expect.any(String),
        },
        [nonExistentId]: {
          status: null,
          failureReason: expect.any(String),
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
});
