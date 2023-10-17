/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/. */
export enum GraphileWorkerPattern {
  BURN_WIRON = 'BURN_WIRON',
  MINT_WIRON = 'MINT_WIRON',
  RELEASE_TEST_USDC = 'RELEASE_TEST_USDC',
  REFRESH_BURN_WIRON_TRANSACTION_STATUS = 'REFRESH_BURN_WIRON_TRANSACTION_STATUS',
  REFRESH_MINT_WIRON_TRANSACTION_STATUS = 'REFRESH_MINT_WIRON_TRANSACTION_STATUS',
  REFRESH_RELEASE_TEST_USDC_TRANSACTION_STATUS = 'REFRESH_RELEASE_TEST_USDC_TRANSACTION_STATUS',

  REFRESH_TEST_USDC_TRANSFERS = 'REFRESH_TEST_USDC_TRANSFERS',
  REFRESH_WIRON_TRANSFERS = 'REFRESH_WIRON_TRANSFERS',
}
