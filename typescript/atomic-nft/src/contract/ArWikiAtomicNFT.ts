import { AtomicNFT } from './AtomicNFT';
import { AtomicNFTState } from '../interfaces/AtomicNFTState';
import { _isValidArweaveAddress } from './ContractUtils';

export class ArWikiAtomicNFT extends AtomicNFT {
  constructor(state: AtomicNFTState, action: ContractInteraction) {
    super(state, action);
  }

  // Override transfer
  public transfer(target: string, qty: number): { state:AtomicNFTState } {
    return super.transfer(target, qty);
  }
}