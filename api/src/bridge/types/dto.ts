/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/. */

import { BridgeRequestStatus, Chain } from '@prisma/client';

type Address = string;

type AddressFk = number;

export type BridgeDataDTO = {
  amount: string;
  source_address: Address;
  destination_address: Address;
  asset: string;
  source_chain: Chain;
  destination_chain: Chain;
  source_transaction: string | null;
  destination_transaction: string | null;
  wiron_burn_transaction?: string | null;
  status: BridgeRequestStatus;
};

export type BridgeRetrieveDTO = {
  [keyof: AddressFk]: BridgeDataDTO | null;
};

export type BridgeSendRequestDTO = {
  id: AddressFk;
  amount: string;
  asset: string;
  source_address: Address;
  source_transaction: string;
};

export type BridgeSendItemDTO = {
  status: BridgeRequestStatus | null;
  failureReason: string | null;
};

export type BridgeSendResponseDTO = {
  [keyof: AddressFk]: BridgeSendItemDTO;
};

export type BridgeCreateDTO = { [keyof: Address]: AddressFk };

export type HeadHash = { hash: string };

export type OptionalHeadHash = { hash: string | null };

export type UpdateWIronRequestDTO = {
  id: AddressFk;
  destination_transaction: string;
  status: BridgeRequestStatus;
};

export type UpdateWIronResponseDTO = {
  [keyof: AddressFk]: { status: BridgeRequestStatus | null };
};
