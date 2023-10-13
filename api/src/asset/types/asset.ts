/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/. */

import { Chain } from '@prisma/client';

/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/. */
export interface Asset {
  chain: Chain;
  sourceSymbol: string;
  destinationSymbol: string;
  assetId: string;
}

const USDC: Asset = {
  chain: Chain.ETHEREUM,
  sourceSymbol: 'USDC',
  destinationSymbol: 'if.USDC',
  assetId: 'foo',
};

export const SupportedAssets: { [key: string]: Asset } = {
  USDC: USDC,
};
