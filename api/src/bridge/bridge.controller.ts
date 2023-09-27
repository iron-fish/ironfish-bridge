/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/. */
import {
  Body,
  Controller,
  Get,
  HttpStatus,
  Post,
  UseGuards,
  ValidationPipe,
} from '@nestjs/common';
import { BridgeRequestStatus } from '@prisma/client';
import { ApiKeyGuard } from '../auth/guards/api-key.guard';
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
} from './types/dto';
import { ApiConfigService } from '../api-config/api-config.service';

@Controller('bridge')
export class BridgeController {
  constructor(
    private readonly config: ApiConfigService,
    private readonly bridgeService: BridgeService,
    private readonly graphileWorkerService: GraphileWorkerService,
  ) {}

  @UseGuards(ApiKeyGuard)
  @Get('retrieve')
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
    const requests = await this.bridgeService.findByIds(sends.map((s) => s.id));
    const map: BridgeSendResponseDTO = {};
    for (const send of sends) {
      const request = requests.find((r) => r.id === send.id) ?? null;
      if (!request) {
        map[send.id] = {
          status: null,
          failureReason: 'requested id not found in bridge service',
        };
        continue;
      }
      if (request.status !== BridgeRequestStatus.CREATED) {
        map[send.id] = {
          status: null,
          failureReason: 'request status is not CREATED',
        };
        continue;
      }
      await this.graphileWorkerService.addJob<MintWIronOptions>(
        GraphileWorkerPattern.MINT_WIRON,
        {
          bridgeRequest: send.id,
          // TODO handle potential error here string -> bigint
          amount: BigInt(request.amount),
          destination: request.destination_address,
        },
      );
      const updated = await this.bridgeService.updateRequest({
        id: request.id,
        status: BridgeRequestStatus.PENDING_PRETRANSFER,
        source_transaction: send.source_transaction ?? undefined,
      });
      map[send.id] = updated
        ? { status: updated.status }
        : {
            status: null,
            failureReason: 'not found when attempting to update request',
          };
    }
    return map;
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
  async getAddress(): Promise<{ address: string }> {
    const address = this.config.get<string>('IRONFISH_BRIDGE_ADDRESS');
    return { address };
  }
}
