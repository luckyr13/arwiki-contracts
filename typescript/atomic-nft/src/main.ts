import { ArWikiAtomicNFTState } from './interfaces/ArWikiAtomicNFTState';
import { ArWikiAtomicNFT } from './contract/ArWikiAtomicNFT';

export async function handle(
  state: ArWikiAtomicNFTState,
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
    return await atomicNFT.transfer(target, qty);
  } else if (method === 'linkedInfo') {
    return atomicNFT.linkedInfo();
  } else if (method === 'updateLinkedContract') {
    const contract = input.contractAddress;
    return await atomicNFT.updateLinkedContract(contract);
  }

  throw new ContractError(`Invalid function!`);
}