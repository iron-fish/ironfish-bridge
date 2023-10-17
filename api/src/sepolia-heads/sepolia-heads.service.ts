/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/. */
import { Injectable } from '@nestjs/common';
import { SepoliaHead } from '@prisma/client';
import {
  TEST_USDC_CONTRACT_ADDRESS,
  WIRON_CONTRACT_ADDRESS,
} from '../common/constants';
import { PrismaService } from '../prisma/prisma.service';
import { BasePrismaClient } from '../prisma/types/base-prisma-client';

@Injectable()
export class SepoliaHeadsService {
  constructor(private readonly prisma: PrismaService) {}

  async wIronHead(): Promise<SepoliaHead> {
    let record = await this.prisma.sepoliaHead.findFirst({
      where: {
        asset: WIRON_CONTRACT_ADDRESS,
      },
    });
    if (!record) {
      record = await this.prisma.sepoliaHead.create({
        data: {
          hash: '0xf1cc4b51c6a75fdf40a14b01eed5f5f6cdc369225557d001e6bca4e4ab308f4f',
          height: 4376698,
          asset: WIRON_CONTRACT_ADDRESS,
        },
      });
    }
    return record;
  }

  async updateWIronHead(
    hash: string,
    height: number,
    prisma: BasePrismaClient,
  ): Promise<SepoliaHead> {
    return prisma.sepoliaHead.upsert({
      create: {
        hash,
        height,
        asset: WIRON_CONTRACT_ADDRESS,
      },
      update: {
        hash,
        height,
      },
      where: {
        asset: WIRON_CONTRACT_ADDRESS,
      },
    });
  }

  async testUsdcHead(): Promise<SepoliaHead> {
    let record = await this.prisma.sepoliaHead.findFirst({
      where: {
        asset: TEST_USDC_CONTRACT_ADDRESS,
      },
    });
    if (!record) {
      record = await this.prisma.sepoliaHead.create({
        data: {
          hash: '0xf9360b26367916a86f331223575185b48ad996dab3a9901200b21e753e3f3ae0',
          height: 4484401,
          asset: TEST_USDC_CONTRACT_ADDRESS,
        },
      });
    }
    return record;
  }

  async updateTestUsdcHead(
    hash: string,
    height: number,
    prisma: BasePrismaClient,
  ): Promise<SepoliaHead> {
    return prisma.sepoliaHead.upsert({
      create: {
        hash,
        height,
        asset: TEST_USDC_CONTRACT_ADDRESS,
      },
      update: {
        hash,
        height,
      },
      where: {
        asset: TEST_USDC_CONTRACT_ADDRESS,
      },
    });
  }
}
