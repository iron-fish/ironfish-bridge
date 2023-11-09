/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/. */
import { Asset, isValidPublicAddress } from '@ironfish/rust-nodejs'
import {
  Assert,
  BufferUtils,
  GetTransactionStreamResponse,
  Meter,
  PromiseUtils,
  RawTransactionSerde,
  RpcClient,
  TimeUtils,
} from '@ironfish/sdk'
import { BurnDescription } from '@ironfish/sdk/src/primitives/burnDescription'
import { Flags } from '@oclif/core'
import { isAddress } from 'web3-validator'
import { BridgeApi } from '../bridgeApi'
import { IronfishCommand } from '../command'
import { RemoteFlags } from '../flags'

const MAX_OUTPUTS_PER_TRANSACTION = 10
const SEND_TRANSACTIONS_INTERVAL_MS = 1000 * 60 * 2
const OWNED_ASSET_IDS = new Set([
  '3723c40e1c8a07f269facfae53453545600a02a1431cd1e03935d1e0256a003a',
])

export default class BridgeRelay extends IronfishCommand {
  static description = `Relay Iron Fish transactions to the Iron Fish <=> Sepolia bridge API`

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
    account: Flags.string({
      char: 'b',
      parse: (input: string): Promise<string> => Promise.resolve(input.trim()),
      required: false,
      description: 'Name of the account to send transactions from',
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

    this.log('Connecting to node...')
    const client = await this.sdk.connectRpc(false, true)

    void this.syncBlocks(
      client,
      api,
      flags.incomingViewKey,
      flags.outgoingViewKey,
      flags.address,
      confirmations,
      flags.fromHead,
    )

    await this.sendTransactions(client, api, flags.account)
  }

  async syncBlocks(
    client: RpcClient,
    api: BridgeApi,
    incomingViewKey: string,
    outgoingViewKey: string,
    bridgeAddress: string,
    confirmations: number,
    head?: string,
  ): Promise<void> {
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
      memoAsHex: true,
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

    const sends = []
    const burns = []
    const releases = []
    const confirms = []

    const transactions = response.transactions

    for (const transaction of transactions) {
      for (const burn of transaction.burns) {
        if (OWNED_ASSET_IDS.has(burn.assetId)) {
          this.log(
            `Confirmed burn of asset ${burn.assetId} in transaction ${transaction.hash}`,
          )
          releases.push({
            source_burn_transaction: transaction.hash,
          })
          continue
        }
      }

      for (const note of transaction.notes) {
        if (!note.memo) {
          continue
        }

        if (note.sender === bridgeAddress) {
          const requestId = Number(
            BufferUtils.toHuman(Buffer.from(note.memo, 'hex')),
          )

          if (isNaN(requestId)) {
            continue
          }

          this.log(
            `Confirmed release of bridge request ${requestId} in transaction ${transaction.hash}`,
          )
          confirms.push({
            id: requestId,
            destination_transaction: transaction.hash,
            status: 'CONFIRMED',
          })
        } else {
          const ethAddress = this.decodeEthAddress(note.memo)

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

  async sendTransactions(
    client: RpcClient,
    api: BridgeApi,
    account?: string,
  ): Promise<void> {
    // eslint-disable-next-line no-constant-condition
    while (true) {
      if (!account) {
        this.log('Fetching bridge account')

        const response = await client.wallet.getDefaultAccount()

        if (!response.content.account) {
          this.error('Bridge node has no account to use')
        }

        account = response.content.account.name
      }

      this.log(`Using account ${account}`)

      // TODO(hughy): balance transaction queueing
      await this.processNextReleaseTransaction(client, account, api)
      await this.processNextBurnTransaction(client, account, api)
      await this.processNextMintTransaction(client, account, api)

      await PromiseUtils.sleep(SEND_TRANSACTIONS_INTERVAL_MS)
    }
  }

  async processNextReleaseTransaction(
    client: RpcClient,
    account: string,
    api: BridgeApi,
  ): Promise<void> {
    const { requests: unprocessedReleaseRequests } =
      await api.getNextReleaseRequests(MAX_OUTPUTS_PER_TRANSACTION)

    if (unprocessedReleaseRequests.length === 0) {
      this.log('No release requests')
      return
    }

    const requestsToProcess = []
    let totalAmount = 0n

    const response = await client.wallet.getAccountBalance({ account })
    const availableBalance = BigInt(response.content.available)

    for (const request of unprocessedReleaseRequests) {
      if (!isValidPublicAddress(request.destination_address)) {
        // TODO (hughy): submit failed status back to bridge API
        continue
      }

      totalAmount += BigInt(request.amount) + 1n
      if (totalAmount > availableBalance) {
        this.log(
          `Bridge account only has available balance for ${requestsToProcess.length} transactions`,
        )
        break
      }

      requestsToProcess.push(request)
    }

    if (requestsToProcess.length === 0) {
      this.log('Available balance too low to process release requests')
      return
    }

    this.log(
      `Sending: ${JSON.stringify(
        requestsToProcess,
        ['id', 'destination_address', 'amount'],
        '   ',
      )}`,
    )

    const outputs = requestsToProcess.map((req) => {
      return {
        publicAddress: req.destination_address,
        amount: req.amount,
        memo: req.id.toString(),
        assetId: Asset.nativeId().toString('hex'),
      }
    })

    const tx = await client.wallet.sendTransaction({
      account,
      outputs,
      fee: BigInt(requestsToProcess.length).toString(),
    })

    this.log(
      `Release: ${JSON.stringify(
        requestsToProcess,
        ['id', 'destination_address', 'amount'],
        '   ',
      )} ${tx.content.hash}`,
    )

    const updatePayload = []
    for (const request of requestsToProcess) {
      updatePayload.push({
        id: request.id,
        destination_transaction: tx.content.hash,
        status: 'PENDING_DESTINATION_RELEASE_TRANSACTION_CONFIRMATION',
      })
    }

    await api.updateRequests(updatePayload)
  }

  async processNextBurnTransaction(
    client: RpcClient,
    account: string,
    api: BridgeApi,
  ): Promise<void> {
    const { requests: nextBurnRequests } = await api.getNextBurnRequests(
      MAX_OUTPUTS_PER_TRANSACTION,
    )

    if (nextBurnRequests.length === 0) {
      this.log('No burn requests')
      return
    }

    const pendingRequests = []

    const balancesResponse = await client.wallet.getAccountBalances({ account })
    const availableBalances: Map<string, bigint> = new Map()
    for (const balance of balancesResponse.content.balances) {
      availableBalances.set(balance.assetId, BigInt(balance.available))
    }

    const burnDescriptions: Map<string, BurnDescription> = new Map()

    for (const request of nextBurnRequests) {
      const assetId = request.asset

      const availableBalance = availableBalances.get(assetId) ?? 0n

      const burnDescription = burnDescriptions.get(assetId) ?? {
        assetId: Buffer.from(assetId, 'hex'),
        value: 0n,
      }

      if (burnDescription.value + BigInt(request.amount) > availableBalance) {
        continue
      }

      burnDescription.value += BigInt(request.amount)
      burnDescriptions.set(assetId, burnDescription)
      pendingRequests.push(request)
    }

    if (burnDescriptions.size === 0) {
      this.log('Available balances too low to burn bridged assets')
      return
    }

    const burns = []
    for (const burn of burnDescriptions.values()) {
      burns.push({
        assetId: burn.assetId.toString('hex'),
        value: burn.value.toString(),
      })
    }

    const createTransactionResponse = await client.wallet.createTransaction({
      account,
      outputs: [],
      burns,
      fee: '1',
    })

    const tx = await client.wallet.postTransaction({
      account,
      transaction: createTransactionResponse.content.transaction,
      broadcast: true,
    })

    this.log(
      `Burn: ${JSON.stringify(
        pendingRequests,
        ['id', 'asset', 'amount'],
        '   ',
      )} ${tx.content.hash}`,
    )

    const updatePayload = []
    for (const request of pendingRequests) {
      updatePayload.push({
        id: request.id,
        source_burn_transaction: tx.content.hash,
        status: 'PENDING_SOURCE_BURN_TRANSACTION_CONFIRMATION',
      })
    }

    await api.updateRequests(updatePayload)
  }

  async processNextMintTransaction(
    client: RpcClient,
    account: string,
    api: BridgeApi,
  ): Promise<void> {
    const { requests: nextMintRequests } = await api.getNextMintRequests(1)
    if (nextMintRequests.length === 0) {
      this.log('No mint requests')
      return
    }

    const mintRequest = nextMintRequests[0]

    const createTransactionResponse = await client.wallet.createTransaction({
      account,
      outputs: [
        {
          amount: mintRequest.amount,
          assetId: mintRequest.asset,
          publicAddress: mintRequest.destination_address,
          memo: mintRequest.id.toString(),
        },
      ],
      mints: [
        {
          value: mintRequest.amount,
          assetId: mintRequest.asset,
        },
      ],
      fee: '1',
    })

    const bytes = Buffer.from(
      createTransactionResponse.content.transaction,
      'hex',
    )
    const raw = RawTransactionSerde.deserialize(bytes)
    const mintTransactionResponse = await client.wallet.postTransaction({
      account,
      transaction: RawTransactionSerde.serialize(raw).toString('hex'),
      broadcast: true,
    })

    this.log(
      `Mint:
        id: ${mintRequest.id}
        asset: ${mintRequest.asset}
        amount: ${mintRequest.amount}
        transaction: ${mintTransactionResponse.content.hash}`,
    )

    await api.updateRequests([
      {
        id: mintRequest.id,
        status: 'PENDING_DESTINATION_MINT_TRANSACTION_CONFIRMATION',
        destination_transaction: mintTransactionResponse.content.hash,
      },
    ])
  }

  async walletIsReady(client: RpcClient, account: string): Promise<boolean> {
    const status = await client.node.getStatus()

    if (!status.content.blockchain.synced) {
      this.log('Blockchain not synced')
      return false
    }

    if (!status.content.peerNetwork.isReady) {
      this.log('Peer network not ready')
      return false
    }

    const balance = await client.wallet.getAccountBalance({
      account,
      assetId: Asset.nativeId().toString('hex'),
    })

    if (BigInt(balance.content.available) <= 0n) {
      this.log('No balance available for transaction fees')
      return false
    }

    return true
  }
}
