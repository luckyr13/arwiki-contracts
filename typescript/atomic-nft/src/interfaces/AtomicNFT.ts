/*
* https://github.com/warp-contracts/atomic-asset-example
* https://atomicnft.com/en/Balance/
* https://academy.warp.cc/docs/sdk/advanced/smartweave-protocol#protocol-specification
* https://github.com/atomic-nfts/standard
* https://cookbook.arweave.dev/concepts/atomic-tokens.html
*/
import { AtomicNFTState } from './AtomicNFTState';

export interface AtomicNFT {
    state: AtomicNFTState;
    action: ContractInteraction;
    input: Record<string, any>;
    caller: string;
    balance(target: string|undefined): {result:{target:string, ticker:string, balance:number}};
    transfer(target: string, qty: number): { state:AtomicNFTState };
}