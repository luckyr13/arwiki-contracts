import { AtomicNFTState } from './interfaces/AtomicNFTState';
import { ArWikiAtomicNFT } from './contract/ArWikiAtomicNFT';

export async function handle(
  state: AtomicNFTState,
  action: ContractInteraction) {
  const atomicNFT = new ArWikiAtomicNFT(state, action);
  const input = action.input;
  const method = action.input.function;

  if (method === 'balance') {
    const target = input.target;
    return atomicNFT.balance(target);
  } else if (method === 'transfer') {
    const target = input.target;
    const qty = input.qty;
    return atomicNFT.transfer(target, qty);
  }

  throw new ContractError(`Invalid function!`);
}