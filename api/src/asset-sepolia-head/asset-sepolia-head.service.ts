/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/. */
import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { BasePrismaClient } from '../prisma/types/base-prisma-client';
import { AssetSepoliaHead } from '.prisma/client';

@Injectable()
export class AssetSepoliaHeadService {
  constructor(private readonly prisma: PrismaService) {}

  async head(): Promise<AssetSepoliaHead> {
    let record = await this.prisma.assetSepoliaHead.findFirst();
    if (!record) {
      record = await this.prisma.assetSepoliaHead.create({
        data: {
          id: 1,
          hash: '0xf1cc4b51c6a75fdf40a14b01eed5f5f6cdc369225557d001e6bca4e4ab308f4f',
          height: 4376698,
        },
      });
    }
    return record;
  }

  async updateHead(
    hash: string,
    height: number,
    prisma: BasePrismaClient,
  ): Promise<AssetSepoliaHead> {
    return prisma.assetSepoliaHead.upsert({
      create: {
        id: 1,
        hash,
        height,
      },
      update: {
        hash,
        height,
      },
      where: {
        id: 1,
      },
    });
  }
}
