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
import { BridgeRequest, BridgeRequestStatus } from '@prisma/client';
import { ApiConfigService } from '../api-config/api-config.service';
import { ApiKeyGuard } from '../auth/guards/api-key.guard';
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
  UpdateWIronRequestDTO,
  UpdateWIronResponseDTO,
} from './types/dto';
import { NextWIronBridgeRequestsDto } from './types/next-wiron-bridge-requests.dto';

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
    Object.keys(response).map(async (r) => {
      await this.graphileWorkerService.addJob<MintWIronOptions>(
        GraphileWorkerPattern.MINT_WIRON,
        {
          bridgeRequest: Number(r),
        },
      );
    });
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
      BridgeRequestStatus.PENDING_SOURCE_BURN_TRANSACTION_CONFIRMATION,
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
    Object.keys(response).map(async (r) => {
      await this.graphileWorkerService.addJob(
        GraphileWorkerPattern.RELEASE_TEST_USDC,
        {
          bridgeRequest: Number(r),
        },
      );
    });
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
  @Post('update_wiron_requests')
  async updateWIronBridgeRequests(
    @Body(
      new ValidationPipe({
        errorHttpStatusCode: HttpStatus.UNPROCESSABLE_ENTITY,
        transform: true,
      }),
    )
    { transactions }: { transactions: UpdateWIronRequestDTO[] },
  ): Promise<UpdateWIronResponseDTO> {
    const requests = await this.bridgeService.findByIds(
      transactions.map((t) => t.id),
    );
    const response: UpdateWIronResponseDTO = {};
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

  @Get('next_wiron_requests')
  @UseGuards(ApiKeyGuard)
  async nextWIronBridgeRequests(
    @Query(
      new ValidationPipe({
        errorHttpStatusCode: HttpStatus.UNPROCESSABLE_ENTITY,
        transform: true,
      }),
    )
    { count }: NextWIronBridgeRequestsDto,
  ): Promise<List<BridgeRequest>> {
    return {
      object: 'list',
      data: await this.bridgeService.nextWIronBridgeRequests(count),
    };
  }

  private async upsertBridgeSendRequestDTOs(
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

      response[request.id] = {
        status: request.status,
        failureReason: null,
      };
    }
    return response;
  }
}
