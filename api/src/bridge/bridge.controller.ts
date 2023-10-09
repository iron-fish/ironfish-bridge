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
import { List } from '../common/interfaces/list';
import { GraphileWorkerPattern } from '../graphile-worker/enums/graphile-worker-pattern';
import { GraphileWorkerService } from '../graphile-worker/graphile-worker.service';
import { MintWIronOptions } from '../wiron/interfaces/mint-wiron-options';
import { BridgeService } from './bridge.service';
import {
  BridgeCreateDTO,
  BridgeDataDTO,
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
    const ids = sends.map((s) => s.id).filter((x) => !!x);
    const requests = await this.bridgeService.findByIds(ids);
    const response: BridgeSendResponseDTO = {};
    for (const send of sends) {
      const request = requests.find((r) => r.id === send.id) ?? null;

      const failureReason = this.validateSend(request, send);

      if (failureReason) {
        response[send.id] = {
          status: BridgeRequestStatus.FAILED,
          failureReason,
        };
        await this.bridgeService.createFailedRequest(request, failureReason);
        continue;
      }

      assert.ok(request);

      await this.graphileWorkerService.addJob<MintWIronOptions>(
        GraphileWorkerPattern.MINT_WIRON,
        {
          bridgeRequest: send.id,
          amount: request.amount,
          destination: request.destination_address,
        },
      );

      const status = BridgeRequestStatus.PENDING_PRETRANSFER;
      await this.bridgeService.updateRequest({
        id: request.id,
        status,
        source_transaction: send.source_transaction ?? undefined,
      });

      response[send.id] = {
        status,
        failureReason: null,
      };
    }
    return response;
  }

  @UseGuards(ApiKeyGuard)
  @Post('create')
  async create(
    @Body(
      new ValidationPipe({
        errorHttpStatusCode: HttpStatus.UNPROCESSABLE_ENTITY,
        transform: true,
      }),
    )
    { requests }: { requests: BridgeDataDTO[] },
  ): Promise<BridgeCreateDTO> {
    const response: BridgeCreateDTO = {};
    const sourceAddresses = await this.bridgeService.upsertRequests(requests);
    for (const a of sourceAddresses) {
      response[a.source_address] = a.id;
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

  validateSend(
    request: BridgeRequest | null,
    send: BridgeSendRequestDTO,
  ): FailureReason | null {
    if (!request) {
      return FailureReason.REQUEST_NON_EXISTENT;
    }
    if (request.status !== BridgeRequestStatus.CREATED) {
      return FailureReason.REQUEST_INVALID_STATUS;
    }
    if (request.source_address !== send.source_address) {
      return FailureReason.REQUEST_SOURCE_ADDRESS_NOT_MATCHING;
    }
    if (request.asset !== send.asset) {
      return FailureReason.REQUEST_ASSET_NOT_MATCHING;
    }
    if (request.amount !== send.amount) {
      return FailureReason.REQUEST_AMOUNT_NOT_MATCHING;
    }
    return null;
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
}
