/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/. */
import { Asset } from '@ironfish/rust-nodejs'
import {
  Assert,
  GetTransactionStreamResponse,
  Meter,
  TimeUtils,
} from '@ironfish/sdk'
import { Flags } from '@oclif/core'
import { isAddress } from 'web3-validator'
import { BridgeApi } from '../bridgeApi'
import { IronfishCommand } from '../command'
import { RemoteFlags } from '../flags'

export default class BridgeRelay extends IronfishCommand {
  static description = `Relay Iron Fish deposits to the Sepolia bridge contract`

  static flags = {
    ...RemoteFlags,
    endpoint: Flags.string({
      char: 'e',
      description: 'API host to sync to',
      parse: (input: string) => Promise.resolve(input.trim()),
      env: 'IRONFISH_API_HOST',
      required: true,
    }),
    token: Flags.string({
      char: 't',
      description: 'API token to authenticate with',
      parse: (input: string) => Promise.resolve(input.trim()),
      env: 'IRONFISH_API_TOKEN',
    }),
    incomingViewKey: Flags.string({
      char: 'k',
      description: 'Incoming view key to watch transactions with',
      parse: (input: string): Promise<string> => Promise.resolve(input.trim()),
      required: true,
    }),
    outgoingViewKey: Flags.string({
      char: 'o',
      description: 'Outgoing view key to watch transactions with',
      parse: (input: string): Promise<string> => Promise.resolve(input.trim()),
      required: true,
    }),
    address: Flags.string({
      char: 'a',
      description: 'Public address of the bridge',
      parse: (input: string): Promise<string> => Promise.resolve(input.trim()),
      required: true,
    }),
    confirmations: Flags.integer({
      char: 'c',
      description:
        'Minimum number of block confirmations needed to process deposits',
      required: false,
    }),
    fromHead: Flags.string({
      char: 'f',
      description: 'The block hash to start following at',
      required: false,
    }),
  }

  async start(): Promise<void> {
    const { flags } = await this.parse(BridgeRelay)

    if (!flags.token) {
      this.log(
        `No api token set. You must set IRONFISH_API_TOKEN env variable or pass --token flag.`,
      )
      this.exit(1)
    }

    const api = new BridgeApi({ host: flags.endpoint, token: flags.token })

    const confirmations =
      flags.confirmations ?? this.sdk.config.get('confirmations')

    await this.syncBlocks(
      api,
      flags.incomingViewKey,
      flags.outgoingViewKey,
      flags.address,
      confirmations,
      flags.fromHead,
    )
  }

  async syncBlocks(
    api: BridgeApi,
    incomingViewKey: string,
    outgoingViewKey: string,
    bridgeAddress: string,
    confirmations: number,
    head?: string,
  ): Promise<void> {
    this.log('Connecting to node...')
    const client = await this.sdk.connectRpc(false, true)

    this.log('Watching with incoming view key:', incomingViewKey)
    this.log('Watching with outgoing view key:', outgoingViewKey)

    head = head ?? (await api.getHead())

    if (!head) {
      const chainInfo = await client.chain.getChainInfo()
      head = chainInfo.content.genesisBlockIdentifier.hash
    }

    this.log(`Starting from head ${head}`)

    const response = client.chain.getTransactionStream({
      incomingViewKey,
      outgoingViewKey,
      head,
    })

    const speed = new Meter()
    speed.start()

    const buffer = new Array<GetTransactionStreamResponse>()

    for await (const content of response.contentStream()) {
      if (content.type === 'connected') {
        buffer.push(content)
        speed.add(1)
      } else if (content.type === 'disconnected') {
        buffer.pop()
      }

      this.logger.debug(
        `${content.type}: ${content.block.hash} - ${content.block.sequence}${
          ' - ' +
          TimeUtils.renderEstimate(
            content.block.sequence,
            content.head.sequence,
            speed.rate5m,
          )
        }`,
      )

      if (buffer.length > confirmations) {
        const response = buffer.shift()
        Assert.isNotUndefined(response)
        await this.commit(api, response, bridgeAddress)
      }
    }
  }

  async commit(
    api: BridgeApi,
    response: GetTransactionStreamResponse,
    bridgeAddress: string,
  ): Promise<void> {
    Assert.isNotUndefined(response)

    const { requests: pendingBurnRequests } = await api.getPendingBurnRequests()

    const pendingBurnTransactions: Map<string, number[]> = new Map()
    for (const request of pendingBurnRequests) {
      Assert.isNotUndefined(request.source_burn_transaction)

      const requestIds =
        pendingBurnTransactions.get(request.source_burn_transaction) ?? []

      requestIds.push(request.id)
      pendingBurnTransactions.set(request.source_burn_transaction, requestIds)
    }

    const sends = []
    const burns = []
    const releases = []
    const confirms = []

    const transactions = response.transactions

    for (const transaction of transactions) {
      if (pendingBurnTransactions.has(transaction.hash)) {
        const requestIds = pendingBurnTransactions.get(transaction.hash) ?? []

        this.log(
          `Confirmed burn for request IDs [${requestIds.toString()}] in transaction ${
            transaction.hash
          }`,
        )

        for (const requestId of requestIds) {
          releases.push({
            id: requestId,
          })
        }

        continue
      }

      for (const note of transaction.notes) {
        if (!note.memo) {
          continue
        }

        if (note.sender === bridgeAddress) {
          const requestId = Number(note.memo)

          if (isNaN(requestId)) {
            continue
          }

          this.log(
            `Confirmed release of bridge request ${note.memo} in transaction ${transaction.hash}`,
          )
          confirms.push({
            id: requestId,
            destination_transaction: transaction.hash,
            status: 'CONFIRMED',
          })
        } else {
          const ethAddress = this.decodeEthAddress(note.memoHex)

          if (!isAddress(ethAddress)) {
            this.log(
              `Received deposit for invalid ETH address ${ethAddress} in transaction ${transaction.hash}`,
            )
            continue
          }

          this.log(
            `Received transaction for ETH address ${ethAddress} and asset ${note.assetId} in transaction ${transaction.hash}`,
          )
          const bridgeRequest = {
            amount: note.value,
            asset: note.assetId,
            source_address: note.sender,
            source_chain: 'IRONFISH',
            source_transaction: transaction.hash,
            destination_address: ethAddress,
            destination_chain: 'ETHEREUM',
          }

          if (note.assetId === Asset.nativeId().toString('hex')) {
            sends.push(bridgeRequest)
          } else {
            burns.push(bridgeRequest)
          }
        }
      }
    }

    if (confirms.length > 0) {
      await api.updateRequests(confirms)
    }

    if (releases.length > 0) {
      await api.bridgeRelease(releases)
    }

    if (sends.length > 0) {
      await api.send(sends)
    }

    if (burns.length > 0) {
      await api.bridgeBurn(burns)
    }

    await api.setHead(response.block.hash)
  }

  decodeEthAddress(memoHex: string): string {
    return Buffer.from(
      Buffer.from(memoHex, 'hex').toString('utf8'),
      'base64',
    ).toString('hex')
  }
}
