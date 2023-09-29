/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/. */
import { Injectable } from '@nestjs/common';
import {
  BridgeHead,
  BridgeRequest,
  BridgeRequestStatus,
  FailedBridgeRequest,
  FailureReason,
} from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { BasePrismaClient } from '../prisma/types/base-prisma-client';
import { BridgeDataDTO } from './types/dto';

@Injectable()
export class BridgeService {
  constructor(private readonly prisma: PrismaService) {}

  async findByIds(ids: number[]): Promise<BridgeRequest[]> {
    return this.prisma.bridgeRequest.findMany({
      where: {
        id: {
          in: ids,
        },
      },
    });
  }

  async upsertRequests(
    requests: BridgeDataDTO[],
    client?: BasePrismaClient,
  ): Promise<BridgeRequest[]> {
    const results = [];
    const prisma = client ?? this.prisma;

    for (const request of requests) {
      let result;

      if (!request.source_transaction) {
        result = await prisma.bridgeRequest.create({
          data: {
            ...request,
          },
        });
      } else {
        result = await prisma.bridgeRequest.upsert({
          create: {
            ...request,
          },
          update: {
            source_transaction: request.source_transaction,
            destination_transaction: request.destination_transaction,
            status: request.status,
          },
          where: {
            source_transaction: request.source_transaction,
          },
        });
      }

      results.push(result);
    }

    return results;
  }

  async updateRequest(options: {
    id: number;
    status?: BridgeRequestStatus;
    destination_transaction?: string;
    source_transaction?: string;
  }): Promise<BridgeRequest | null> {
    return this.prisma.bridgeRequest.update({
      data: options,
      where: {
        id: options.id,
      },
    });
  }

  async updateHead(hash: string): Promise<BridgeHead> {
    await this.prisma.bridgeHead.deleteMany();
    return this.prisma.bridgeHead.create({
      data: { hash },
    });
  }

  async getHead(): Promise<BridgeHead | null> {
    return this.prisma.bridgeHead.findFirst();
  }

  async createFailedRequest(
    request: BridgeRequest | null,
    failure_reason: FailureReason,
  ): Promise<FailedBridgeRequest> {
    const bridge_request = request
      ? { connect: { id: request.id } }
      : undefined;
    return this.prisma.failedBridgeRequest.create({
      data: {
        bridge_request,
        failure_reason,
      },
    });
  }

  async nextWIronBridgeRequests(count?: number): Promise<BridgeRequest[]> {
    count = count ?? 1

    const currentlyRunningWIronRequests = this.prisma.bridgeRequest.findMany({
      where: {
        source_chain: 'ETHEREUM',
        destination_chain: 'IRONFISH',
        status: {
          in: [BridgeRequestStatus.PENDING_ON_DESTINATION_CHAIN, BridgeRequestStatus.PENDING_PRETRANSFER]
        }
      },
      orderBy: {
        cre
      },
      take: count,
    });
    const currentlyRunningFaucetTransactions =
        await prisma.faucetTransaction.findMany({
          where: {
            started_at: {
              not: null,
            },
            completed_at: null,
          },
          orderBy: {
            created_at: Prisma.SortOrder.asc,
          },
          take: count,
        });
      if (currentlyRunningFaucetTransactions.length < count) {
        const diff = count - currentlyRunningFaucetTransactions.length;
        const unfulfilledFaucetTransactions =
          await prisma.faucetTransaction.findMany({
            where: {
              started_at: null,
              completed_at: null,
            },
            orderBy: {
              created_at: Prisma.SortOrder.asc,
            },
            take: diff,
          });
        return [
          ...currentlyRunningFaucetTransactions,
          ...unfulfilledFaucetTransactions,
        ];
      }

      return currentlyRunningFaucetTransactions;
  }
}
