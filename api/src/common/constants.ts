/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/. */
export const SEPOLIA_EXPLORER_URL = 'https://sepolia.etherscan.io';
export const SEPOLIA_BLOCK_TIME_MS = 15 * 1000;

export const WIRON_CONTRACT_ADDRESS =
  '0x3de166740d64d522abfda77d9d878dfedfdeeede';

export const TEST_USDC_CONTRACT_ADDRESS =
  '0xe6794acc5830b34ae0e86c1801603a17e3ca7c11';

export const IRON_ASSET_ID =
  '51f33a2f14f92735e562dc658a5639279ddca3d5079a6d1242b2a588a9cbf44c';

export const IF_TEST_USDC_ASSET_ID =
  '3723c40e1c8a07f269facfae53453545600a02a1431cd1e03935d1e0256a003a';

export const SupportedAssets = {
  [IRON_ASSET_ID]: WIRON_CONTRACT_ADDRESS,
  [IF_TEST_USDC_ASSET_ID]: TEST_USDC_CONTRACT_ADDRESS,
};
