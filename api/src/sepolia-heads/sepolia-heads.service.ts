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
          hash: '0x9b99b712ea74b180d837db052469f0d96c71097d10d560bbdf29e291d753988f',
          height: 4655600,
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
          hash: '0x9b99b712ea74b180d837db052469f0d96c71097d10d560bbdf29e291d753988f',
          height: 4655600,
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
