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
  UseGuards,
  ValidationPipe,
} from '@nestjs/common';
import { BridgeRequestStatus, FailureReason } from '@prisma/client';
import assert from 'assert';
import { SupportedAssets } from '../../../constants';
import { ApiConfigService } from '../api-config/api-config.service';
import { ApiKeyGuard } from '../auth/guards/api-key.guard';
import { GraphileWorkerPattern } from '../graphile-worker/enums/graphile-worker-pattern';
import { GraphileWorkerService } from '../graphile-worker/graphile-worker.service';
import { MintWIronOptions } from '../wiron/interfaces/mint-wiron-options';
import { BridgeService } from './bridge.service';
import {
  BridgeRetrieveDTO,
  BridgeRetrieveRequest,
  BridgeSendRequestDTO,
  BridgeSendResponseDTO,
  HeadHash,
  OptionalHeadHash,
  ReleaseRequestDTO,
  UpdateRequestDTO,
  UpdateResponseDTO,
} from './types/dto';

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
    req: BridgeRetrieveRequest,
  ): Promise<BridgeRetrieveDTO> {
    const where = {
      source_chain: req.source_chain,
      destination_chain: req.destination_chain,
      status: req.status,
    };
    const requests = await this.bridgeService.findWhere(where, req.count);
    return { requests };
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
    { releases }: { releases: ReleaseRequestDTO[] },
  ): Promise<UpdateResponseDTO> {
    const response: UpdateResponseDTO = {};
    for (const release of releases) {
      const requests = await this.bridgeService.findBySourceBurnTransaction(
        release.source_burn_transaction,
      );

      for (const request of requests) {
        await this.bridgeService.updateRequest({
          id: request.id,
          status:
            BridgeRequestStatus.PENDING_DESTINATION_RELEASE_TRANSACTION_CREATION,
        });

        response[request.id] = {
          status:
            BridgeRequestStatus.PENDING_DESTINATION_RELEASE_TRANSACTION_CREATION,
        };

        await this.graphileWorkerService.addJob(
          GraphileWorkerPattern.RELEASE_TEST_USDC,
          {
            bridgeRequestId: request.id,
          },
        );
      }
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
        ...transaction,
      });

      response[transaction.id] = { status: transaction.status };
    }
    return response;
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
