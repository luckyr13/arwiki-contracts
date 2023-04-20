import { ArWikiContract } from './contract/ArWikiContract';
import { ArWikiContractState } from './interfaces/ArWikiContractState';

export async function handle(
  state: ArWikiContractState,
  action: ContractInteraction
) {
  const arwiki = new ArWikiContract(state, action);
  const input = action.input;
  const method = action.input.function;

  if (method === 'balance') {
    const target = input.target;
    return arwiki.balance(target);
  } else if (method === 'transfer') {
    const target = input.target;
    const qty = input.qty;
    return arwiki.transfer(target, qty);
  } else if (method === 'unlockedBalance') {
    const target = input.target;
    return arwiki.unlockedBalance(target);
  } else if (method === 'lock') {
    const qty = input.qty;
    const lockLength = input.lockLength;
    return arwiki.lock(qty, lockLength);
  } 

	throw new ContractError(`No function supplied or function not recognised: "${input.function}"`);
}