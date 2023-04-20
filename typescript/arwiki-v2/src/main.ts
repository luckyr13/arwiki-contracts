import { ArWikiContract } from './contract/ArWikiContract';
import { PSTContractState } from './interfaces/PSTContractState';

async function handle(state: PSTContractState, action: ContractInteraction) {
  const settings = new Map(state.settings);
  const balances = state.balances;
  const vault = state.vault;
  const votes = state.votes;
  const input = action.input;
  const caller = action.caller;
  const arwiki = new ArWikiContract(state);

	throw new ContractError(`No function supplied or function not recognised: "${input.function}"`);
}