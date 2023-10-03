/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/. */
import { BridgeRequestStatus, Chain } from '@prisma/client';
import { BridgeDataDTO } from '../bridge/types/dto';

export const bridgeRequestDTO = (options: {
  destination_address?: string;
  source_address?: string;
  amount?: string;
  status?: BridgeRequestStatus;
  wiron_burn_transaction?: string;
}): BridgeDataDTO => ({
  amount: options.amount ?? '100',
  source_address: options.source_address ?? '0x0000000',
  asset: '51f33a2f14f92735e562dc658a5639279ddca3d5079a6d1242b2a588a9cbf44c',
  source_transaction:
    '00000000000000021a63de16fea25d79f66f092862a893274690000000000000',
  destination_address: options.destination_address ?? 'foooooooooooo',
  destination_transaction: null,
  status: options.status ?? BridgeRequestStatus.CREATED,
  source_chain: Chain.ETHEREUM,
  destination_chain: Chain.IRONFISH,
  wiron_burn_transaction: options.wiron_burn_transaction ?? null,
});
