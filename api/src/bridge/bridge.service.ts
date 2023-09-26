/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/. */
import { Injectable } from '@nestjs/common';
import { BridgeHead, BridgeRequest } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { BridgeDataDTO } from './dto';

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

  async upsertRequests(requests: BridgeDataDTO[]): Promise<BridgeRequest[]> {
    const results = [];

    for (const request of requests) {
      let result;

      if (!request.source_transaction) {
        result = await this.prisma.bridgeRequest.create({
          data: {
            ...request,
          },
        });
      } else {
        result = await this.prisma.bridgeRequest.update({
          data: {
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

  async updateHead(hash: string): Promise<BridgeHead> {
    await this.prisma.bridgeHead.deleteMany();
    return this.prisma.bridgeHead.create({
      data: { hash },
    });
  }

  async getHead(): Promise<BridgeHead | null> {
    return this.prisma.bridgeHead.findFirst();
  }
}
