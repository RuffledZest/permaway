// Type definitions for ArConnect wallet
declare global {
  interface Window {
    arweaveWallet?: {
      connect(permissions: string[]): Promise<void>
      disconnect(): Promise<void>
      getActiveAddress(): Promise<string>
      getAllAddresses(): Promise<string[]>
      getWalletNames(): Promise<{ [addr: string]: string }>
      sign(transaction: any, options?: any): Promise<any>
      getPermissions(): Promise<string[]>
      encrypt(data: string, options: any): Promise<Uint8Array>
      decrypt(data: Uint8Array, options: any): Promise<string>
      signature(data: Uint8Array, algorithm: any): Promise<Uint8Array>
      getPublicKey(): Promise<string>
      getArweaveConfig(): Promise<any>
    }
  }
}

export {}