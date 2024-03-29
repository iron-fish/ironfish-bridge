/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/. */
import { Injectable } from '@nestjs/common';
import {
  BridgeRequest,
  BridgeRequestStatus,
  FailedBridgeRequest,
  FailureReason,
  IronFishTestnetHead,
  Prisma,
} from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { BasePrismaClient } from '../prisma/types/base-prisma-client';
import { BridgeDataDTO } from './types/dto';

@Injectable()
export class BridgeService {
  constructor(private readonly prisma: PrismaService) {}

  async find(id: number): Promise<BridgeRequest | null> {
    return this.prisma.bridgeRequest.findFirst({
      where: { id },
    });
  }

  async findOrThrow(id: number): Promise<BridgeRequest> {
    return this.prisma.bridgeRequest.findFirstOrThrow({
      where: { id },
    });
  }

  async findByIds(ids: number[]): Promise<BridgeRequest[]> {
    return this.prisma.bridgeRequest.findMany({
      where: {
        id: {
          in: ids,
        },
      },
    });
  }

  async findWhere(
    where: Prisma.BridgeRequestWhereInput,
    count: number | undefined,
  ): Promise<BridgeRequest[]> {
    return this.prisma.bridgeRequest.findMany({
      where,
      orderBy: {
        id: Prisma.SortOrder.asc,
      },
      take: count,
    });
  }

  async findBySourceTransaction(
    sourceTransaction: string,
  ): Promise<BridgeRequest | null> {
    return this.prisma.bridgeRequest.findUnique({
      where: {
        source_transaction: sourceTransaction,
      },
    });
  }

  async findBySourceBurnTransaction(
    sourceBurnTransaction: string,
  ): Promise<BridgeRequest[]> {
    return this.prisma.bridgeRequest.findMany({
      where: {
        source_burn_transaction: sourceBurnTransaction,
      },
    });
  }

  async upsertRequests(
    requests: BridgeDataDTO[],
    client?: BasePrismaClient,
  ): Promise<BridgeRequest[]> {
    const results = [];
    for (const request of requests) {
      results.push(await this.upsertRequest(request, client));
    }
    return results;
  }

  async upsertRequest(
    request: BridgeDataDTO,
    client?: BasePrismaClient,
  ): Promise<BridgeRequest> {
    const prisma = client ?? this.prisma;
    return prisma.bridgeRequest.upsert({
      create: {
        ...request,
      },
      update: {
        ...request,
      },
      where: {
        source_transaction: request.source_transaction,
      },
    });
  }

  async updateRequest(
    options: {
      id: number;
      status?: BridgeRequestStatus;
      destination_transaction?: string;
      source_transaction?: string;
      source_burn_transaction?: string;
      failure_reason?: FailureReason;
    },
    client?: BasePrismaClient,
  ): Promise<BridgeRequest | null> {
    const prisma = client ?? this.prisma;
    return prisma.bridgeRequest.update({
      data: options,
      where: {
        id: options.id,
      },
    });
  }

  async updateHead(hash: string): Promise<IronFishTestnetHead> {
    await this.prisma.ironFishTestnetHead.deleteMany();
    return this.prisma.ironFishTestnetHead.create({
      data: { hash },
    });
  }

  async getHead(): Promise<IronFishTestnetHead | null> {
    return this.prisma.ironFishTestnetHead.findFirst();
  }

  async createFailedRequest(
    request: BridgeRequest | null,
    failureReason: FailureReason,
    error?: string,
    client?: BasePrismaClient,
  ): Promise<FailedBridgeRequest> {
    const prisma = client ?? this.prisma;
    const bridge_request = request
      ? { connect: { id: request.id } }
      : undefined;
    return prisma.failedBridgeRequest.create({
      data: {
        bridge_request,
        error,
        failure_reason: failureReason,
      },
    });
  }
}
