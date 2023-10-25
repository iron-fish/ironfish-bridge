/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/. */
import axios, { AxiosError, AxiosRequestConfig } from 'axios'

type BridgeRequest = {
  id: number
  asset: string
  source_address: string
  destination_address: string
  amount: string
  source_chain: string
  destination_chain: string
  source_transaction?: string
  destination_transaction?: string
  source_burn_transaction?: string
  status: string
}

/**
 *  The API should be compatible with the Ironfish Bridge API
 *  https://github.com/iron-fish/ironfish-bridge
 */
export class WebApi {
  host: string
  token: string

  constructor(options: { host: string; token?: string }) {
    let host = options.host

    if (host.endsWith('/')) {
      host = host.slice(0, -1)
    }

    this.host = host
    this.token = options.token || ''
  }

  async getBridgeHead(): Promise<string | undefined> {
    this.requireToken()

    const response = await axios
      .get<{ hash: string }>(`${this.host}/bridge/head`, this.options())
      .catch((e) => {
        // The API returns 404 for no head
        if (IsAxiosError(e) && e.response?.status === 404) {
          return null
        }

        throw e
      })

    return response?.data.hash
  }

  async setBridgeHead(head: string): Promise<void> {
    this.requireToken()

    const options = this.options({ 'Content-Type': 'application/json' })

    await axios.post(`${this.host}/bridge/head`, { head }, options)
  }

  async sendBridgeDeposits(
    sends: {
      amount: string
      asset: string
      source_address: string
      source_chain: string
      source_transaction: string
      destination_address: string
      destination_chain: string
    }[],
  ): Promise<void> {
    this.requireToken()

    await axios.post(`${this.host}/bridge/send`, { sends }, this.options())
  }

  async bridgeBurn(
    burns: {
      amount: string
      asset: string
      source_address: string
      source_chain: string
      source_transaction: string
      destination_address: string
      destination_chain: string
    }[],
  ): Promise<void> {
    this.requireToken()

    await axios.post(`${this.host}/bridge/burn`, { burns }, this.options())
  }

  async bridgeRelease(releases: { id: number }[]): Promise<void> {
    this.requireToken()

    await axios.post(
      `${this.host}/bridge/release`,
      { releases },
      this.options(),
    )
  }

  async getBridgeNextReleaseRequests(
    count?: number,
  ): Promise<{ requests: Array<BridgeRequest> }> {
    this.requireToken()
    const response = await axios.post<{ requests: Array<BridgeRequest> }>(
      `${this.host}/bridge/retrieve/`,
      {
        source_chain: 'ETHEREUM',
        destination_chain: 'IRONFISH',
        status: 'PENDING_DESTINATION_RELEASE_TRANSACTION_CREATION',
        count: count ?? 1,
      },
      this.options(),
    )
    return response.data
  }

  async getBridgeNextMintRequests(
    count?: number,
  ): Promise<{ requests: Array<BridgeRequest> }> {
    this.requireToken()

    const response = await axios.post<{ requests: Array<BridgeRequest> }>(
      `${this.host}/bridge/retrieve/`,
      {
        source_chain: 'ETHEREUM',
        destination_chain: 'IRONFISH',
        status: 'PENDING_DESTINATION_MINT_TRANSACTION_CREATION',
        count: count ?? 1,
      },
      this.options(),
    )
    return response.data
  }

  async getBridgeNextBurnRequests(
    count?: number,
  ): Promise<{ requests: Array<BridgeRequest> }> {
    this.requireToken()

    const response = await axios.post<{ requests: Array<BridgeRequest> }>(
      `${this.host}/bridge/retrieve/`,
      {
        source_chain: 'IRONFISH',
        destination_chain: 'ETHEREUM',
        status: 'PENDING_SOURCE_BURN_TRANSACTION_CREATION',
        count: count ?? 1,
      },
      this.options(),
    )
    return response.data
  }

  async getBridgePendingBurnRequests(
    count?: number,
  ): Promise<{ requests: Array<BridgeRequest> }> {
    this.requireToken()

    const response = await axios.post<{ requests: Array<BridgeRequest> }>(
      `${this.host}/bridge/retrieve`,
      {
        source_chain: 'IRONFISH',
        destination_chain: 'ETHEREUM',
        status: 'PENDING_SOURCE_BURN_TRANSACTION_CONFIRMATION',
        count,
      },
      this.options(),
    )

    return response.data
  }

  async updateBridgeRequests(
    payload: Array<{
      id: number
      status: string
      destination_transaction?: string
      source_burn_transaction?: string
    }>,
  ): Promise<{ [keyof: string]: { status: string } }> {
    this.requireToken()

    const response = await axios.post<{ [keyof: number]: { status: string } }>(
      `${this.host}/bridge/update_requests/`,
      { transactions: payload },
      this.options(),
    )

    return response.data
  }

  options(headers: Record<string, string> = {}): AxiosRequestConfig {
    return {
      headers: {
        Authorization: `Bearer ${this.token}`,
        ...headers,
      },
    }
  }

  requireToken(): void {
    if (!this.token) {
      throw new Error(`Token required for endpoint`)
    }
  }
}

export function IsAxiosError(e: unknown): e is AxiosError {
  return typeof e === 'object' && e != null && HasOwnProperty(e, 'isAxiosError')
}

// eslint-disable-next-line @typescript-eslint/ban-types
export function HasOwnProperty<X extends {}, Y extends PropertyKey>(
  obj: X,
  prop: Y,
): boolean {
  return Object.hasOwnProperty.call(obj, prop)
}
