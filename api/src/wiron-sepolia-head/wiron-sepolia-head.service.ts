/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/. */
import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { WIronSepoliaHead } from '.prisma/client';

@Injectable()
export class WIronSepoliaHeadService {
  constructor(private readonly prisma: PrismaService) {}

  async head(): Promise<WIronSepoliaHead> {
    let record = await this.prisma.wIronSepoliaHead.findFirst();
    if (!record) {
      record = await this.prisma.wIronSepoliaHead.create({
        data: {
          id: 1,
          hash: '0xf1cc4b51c6a75fdf40a14b01eed5f5f6cdc369225557d001e6bca4e4ab308f4f',
          height: 4376698,
        },
      });
    }
    return record;
  }

  async updateHead(hash: string, height: number): Promise<WIronSepoliaHead> {
    return this.prisma.wIronSepoliaHead.upsert({
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
