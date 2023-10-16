/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/. */
import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  Query,
  UseGuards,
  ValidationPipe,
} from '@nestjs/common';
import {
  BridgeRequest,
  BridgeRequestStatus,
  FailureReason,
} from '@prisma/client';
import assert from 'assert';
import { ApiConfigService } from '../api-config/api-config.service';
import { ApiKeyGuard } from '../auth/guards/api-key.guard';
import { SupportedAssets } from '../common/constants';
import { List } from '../common/interfaces/list';
import { GraphileWorkerPattern } from '../graphile-worker/enums/graphile-worker-pattern';
import { GraphileWorkerService } from '../graphile-worker/graphile-worker.service';
import { MintWIronOptions } from '../wiron/interfaces/mint-wiron-options';
import { BridgeService } from './bridge.service';
import {
  BridgeRetrieveDTO,
  BridgeSendRequestDTO,
  BridgeSendResponseDTO,
  HeadHash,
  OptionalHeadHash,
  UpdateRequestDTO,
  UpdateResponseDTO,
} from './types/dto';
import { NextBridgeRequestsDto } from './types/next-bridge-requests.dto';

@Controller('bridge')
export class BridgeController {
  constructor(
    private readonly config: ApiConfigService,
    private readonly bridgeService: BridgeService,
    private readonly graphileWorkerService: GraphileWorkerService,
  ) {}

  @UseGuards(ApiKeyGuard)
  @Post('retrieve')
  @HttpCode(200)
  async retrieve(
    @Body(
      new ValidationPipe({
        errorHttpStatusCode: HttpStatus.UNPROCESSABLE_ENTITY,
        transform: true,
      }),
    )
    { ids }: { ids: number[] },
  ): Promise<BridgeRetrieveDTO> {
    const requests = await this.bridgeService.findByIds(ids);
    const map: BridgeRetrieveDTO = {};
    for (const id of ids) {
      map[id] = requests.find((r) => r.id === id) ?? null;
    }
    return map;
  }

  @UseGuards(ApiKeyGuard)
  @Post('send')
  async send(
    @Body(
      new ValidationPipe({
        errorHttpStatusCode: HttpStatus.UNPROCESSABLE_ENTITY,
        transform: true,
      }),
    )
    { sends }: { sends: BridgeSendRequestDTO[] },
  ): Promise<BridgeSendResponseDTO> {
    const response = await this.upsertBridgeSendRequestDTOs(
      sends,
      BridgeRequestStatus.PENDING_DESTINATION_MINT_TRANSACTION_CREATION,
    );
    for (const key in response) {
      if (response[key].status === BridgeRequestStatus.FAILED) {
        continue;
      }
      await this.graphileWorkerService.addJob<MintWIronOptions>(
        GraphileWorkerPattern.MINT_WIRON,
        {
          bridgeRequest: Number(key),
        },
      );
    }
    return response;
  }

  @UseGuards(ApiKeyGuard)
  @Post('burn')
  async burn(
    @Body(
      new ValidationPipe({
        errorHttpStatusCode: HttpStatus.UNPROCESSABLE_ENTITY,
        transform: true,
      }),
    )
    { burns }: { burns: BridgeSendRequestDTO[] },
  ): Promise<BridgeSendResponseDTO> {
    const response = await this.upsertBridgeSendRequestDTOs(
      burns,
      BridgeRequestStatus.PENDING_SOURCE_BURN_TRANSACTION_CREATION,
    );
    return response;
  }

  @UseGuards(ApiKeyGuard)
  @Post('release')
  async release(
    @Body(
      new ValidationPipe({
        errorHttpStatusCode: HttpStatus.UNPROCESSABLE_ENTITY,
        transform: true,
      }),
    )
    { releases }: { releases: BridgeSendRequestDTO[] },
  ): Promise<BridgeSendResponseDTO> {
    const response = await this.upsertBridgeSendRequestDTOs(
      releases,
      BridgeRequestStatus.PENDING_DESTINATION_RELEASE_TRANSACTION_CREATION,
    );
    for (const key in response) {
      if (response[key].status === BridgeRequestStatus.FAILED) {
        continue;
      }
      await this.graphileWorkerService.addJob(
        GraphileWorkerPattern.RELEASE_TEST_USDC,
        {
          bridgeRequest: Number(key),
        },
      );
    }
    return response;
  }

  @UseGuards(ApiKeyGuard)
  @Post('head')
  async postHead(
    @Body(
      new ValidationPipe({
        errorHttpStatusCode: HttpStatus.UNPROCESSABLE_ENTITY,
        transform: true,
      }),
    )
    { head }: { head: string },
  ): Promise<HeadHash> {
    const returnedHead = await this.bridgeService.updateHead(head);
    return { hash: returnedHead.hash };
  }

  @UseGuards(ApiKeyGuard)
  @Get('head')
  async getHead(): Promise<OptionalHeadHash> {
    const ethBridgeHead = await this.bridgeService.getHead();
    const head = ethBridgeHead ? ethBridgeHead.hash : null;
    return { hash: head };
  }

  @Get('address')
  getAddress(): { address: string } {
    const address = this.config.get<string>('IRONFISH_BRIDGE_ADDRESS');
    return { address };
  }

  @UseGuards(ApiKeyGuard)
  @Post('update_requests')
  async updateBridgeRequests(
    @Body(
      new ValidationPipe({
        errorHttpStatusCode: HttpStatus.UNPROCESSABLE_ENTITY,
        transform: true,
      }),
    )
    { transactions }: { transactions: UpdateRequestDTO[] },
  ): Promise<UpdateResponseDTO> {
    const requests = await this.bridgeService.findByIds(
      transactions.map((t) => t.id),
    );
    const response: UpdateResponseDTO = {};
    for (const transaction of transactions) {
      const request = requests.find((r) => r.id === transaction.id) ?? null;

      if (!request) {
        response[transaction.id] = { status: null };
        continue;
      }

      await this.bridgeService.updateRequest({
        id: transaction.id,
        status: transaction.status,
        destination_transaction: transaction.destination_transaction,
      });

      response[transaction.id] = { status: transaction.status };
    }
    return response;
  }

  @Get('next_release_requests')
  @UseGuards(ApiKeyGuard)
  async nextReleaseBridgeRequests(
    @Query(
      new ValidationPipe({
        errorHttpStatusCode: HttpStatus.UNPROCESSABLE_ENTITY,
        transform: true,
      }),
    )
    { count }: NextBridgeRequestsDto,
  ): Promise<List<BridgeRequest>> {
    return {
      object: 'list',
      data: await this.bridgeService.nextReleaseBridgeRequests(count),
    };
  }

  @Get('next_burn_requests')
  @UseGuards(ApiKeyGuard)
  async nextBurnBridgeRequests(
    @Query(
      new ValidationPipe({
        errorHttpStatusCode: HttpStatus.UNPROCESSABLE_ENTITY,
        transform: true,
      }),
    )
    { count }: NextBridgeRequestsDto,
  ): Promise<List<BridgeRequest>> {
    return {
      object: 'list',
      data: await this.bridgeService.nextBurnBridgeRequests(count),
    };
  }

  async upsertBridgeSendRequestDTOs(
    payloads: BridgeSendRequestDTO[],
    status: BridgeRequestStatus,
  ) {
    const response: BridgeSendResponseDTO = {};

    for (const payload of payloads) {
      let request = await this.bridgeService.findBySourceTransaction(
        payload.source_transaction,
      );
      if (!request) {
        let destinationAddress = payload.destination_address;
        if (!destinationAddress.startsWith('0x')) {
          destinationAddress = `0x${destinationAddress}`;
        }

        request = await this.bridgeService.upsertRequest({
          amount: payload.amount,
          asset: payload.asset,
          destination_address: destinationAddress,
          destination_chain: payload.destination_chain,
          destination_transaction: null,
          source_address: payload.source_address,
          source_chain: payload.source_chain,
          source_transaction: payload.source_transaction,
          status,
        });
      }

      let failureReason = request.failure_reason;
      if (!(request.asset in SupportedAssets)) {
        request = await this.bridgeService.updateRequest({
          id: request.id,
          status: BridgeRequestStatus.FAILED,
          failure_reason: FailureReason.REQUEST_ASSET_NOT_MATCHING,
        });
        assert.ok(request);
        await this.bridgeService.createFailedRequest(
          request,
          FailureReason.REQUEST_ASSET_NOT_MATCHING,
          `Request asset is not supported: ${
            request.asset
          }. Supported: ${JSON.stringify(SupportedAssets)} `,
        );
        failureReason = FailureReason.REQUEST_ASSET_NOT_MATCHING;
      }

      response[request.id] = {
        status: request.status,
        failureReason,
      };
    }
    return response;
  }
}
