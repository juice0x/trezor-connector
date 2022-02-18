import { BaseWalletSubprovider } from "@0x/subproviders/lib/src/subproviders/base_wallet_subprovider"
import { Transaction } from 'ethereumjs-tx'
import { TrezorSubproviderConfig } from "@0x/subproviders/lib/src/types"


const PRIVATE_KEY_PATH = `44'/60'/0'/0/0`;

export class TrezorSubprovider extends BaseWalletSubprovider {
  private readonly _derivationPath: string
  private readonly _trezorConnectClientApi: any
  private readonly _networkId: number
  private _privateKeyPath: string

  /**
   * Instantiates a TrezorSubprovider. Defaults to private key path set to `44'/60'/0'/0/`.
   * Must be initialized with trezor-connect API module https://github.com/trezor/connect.
   * @param TrezorSubprovider config object containing trezor-connect API
   * @return TrezorSubprovider instance
   */
  constructor(config: TrezorSubproviderConfig) {
    super();
    this._derivationPath = PRIVATE_KEY_PATH
    this._privateKeyPath = `m/${this._derivationPath}`
    this._trezorConnectClientApi = config.trezorConnectClientApi
    this._networkId = config.networkId;
  }

  /**
   * Retrieve a users Trezor account. This method is automatically called
   * when issuing a `eth_accounts` JSON RPC request via your providerEngine
   * instance.
   * @return An array of accounts
   */
  public async getAccountsAsync(): Promise<string[]> {
    const response = await this._trezorConnectClientApi.ethereumGetAddress({
      path: `m/${this._derivationPath}`
    })
    if (response.success){
      this._privateKeyPath = response.payload.serializedPath
      return [response.payload.address]
    }
    return []
  }

  /**
   * Signs a transaction on the Trezor with the account specificed by the `from` field in txParams.
   * If you've added the TrezorSubprovider to your app's provider, you can simply send an `eth_sendTransaction`
   * JSON RPC request, and this method will be called auto-magically. If you are not using this via a ProviderEngine
   * instance, you can call it directly.
   * @param txParams Parameters of the transaction to sign
   * @return Signed transaction hex string
   */
  public async signTransactionAsync(txData: any): Promise<string> {
    const txPayload = {
      ...txData,
      chainId: this._networkId,
    }
    const response = await this._trezorConnectClientApi.ethereumSignTransaction({
      path: this._privateKeyPath,
      transaction: txPayload
    })
    if (response.success) {
      const payload = response.payload
      const tx = new Transaction(txPayload)
      // Set the EIP155 bits
      tx.raw[6] = Buffer.from([this._networkId]) // v
      tx.raw[7] = Buffer.from([]) // r
      tx.raw[8] = Buffer.from([]) // s

      // slice off leading 0x
      tx.v = Buffer.from(payload.v.slice(2), 'hex')
      tx.r = Buffer.from(payload.r.slice(2), 'hex')
      tx.s = Buffer.from(payload.s.slice(2), 'hex')

      return `0x${tx.serialize().toString("hex")}`
    } else {
      throw new Error(response.payload.error)
    }
  }

   /**
   * Sign a personal Ethereum signed message. The signing account will be the account
   * associated with the provided address. If you've added the TrezorSubprovider to
   * your app's provider, you can simply send an `eth_sign` or `personal_sign` JSON RPC
   * request, and this method will be called auto-magically.
   * If you are not using this via a ProviderEngine instance, you can call it directly.
   * @param data Hex string message to sign
   * @param address Address of the account to sign with
   * @return Signature hex string (order: rsv)
   */
  public async signPersonalMessageAsync(data: any, address: string): Promise<string> {
    const response = await this._trezorConnectClientApi.ethereumSignMessage({
      path: this._privateKeyPath,
      message: data,
      hex: true
    })
    if (response.success) {
      const payload = response.payload
      if (payload.address !== address) {
        throw new Error(`address unknown ${address}`)
      }
      return `0x${payload.signature}`
    } else {
      throw new Error(response.payload.error)
    }
  }

  /**
   * TODO:: eth_signTypedData is currently not supported on Trezor devices.
   * @param address Address of the account to sign with
   * @param data the typed data object
   * @return Signature hex string (order: rsv)
   */
  // tslint:disable-next-line:prefer-function-over-method
  public async signTypedDataAsync(address: string, typedData: any): Promise<string> {
    throw new Error(`METHOD_NOT_SUPPORTED: signTypedData ${address} ${typedData}`)
  }
}