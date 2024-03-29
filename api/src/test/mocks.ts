/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/. */
import { BridgeRequestStatus, Chain } from '@prisma/client';
import { IRON_ASSET_ID } from '../../../constants';
import { BridgeDataDTO } from '../bridge/types/dto';

export const bridgeRequestDTO = (options: {
  destination_address?: string;
  source_address?: string;
  amount?: string;
  asset?: string;
  status?: BridgeRequestStatus;
  source_burn_transaction?: string;
  destination_transaction?: string;
  source_chain?: Chain;
  destination_chain?: Chain;
}): BridgeDataDTO => ({
  amount: options.amount ?? '100',
  source_address: options.source_address ?? '0x0000000',
  asset: options.asset ?? IRON_ASSET_ID,
  source_transaction:
    '00000000000000021a63de16fea25d79f66f092862a893274690000000000000',
  destination_address: options.destination_address ?? '0xfoooooooooooo',
  destination_transaction: options.destination_transaction ?? null,
  status: options.status ?? BridgeRequestStatus.CREATED,
  source_chain: options.source_chain ?? Chain.ETHEREUM,
  destination_chain: options.destination_chain ?? Chain.IRONFISH,
  source_burn_transaction: options.source_burn_transaction ?? null,
});
