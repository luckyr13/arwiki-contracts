/*
* Based on CommunityXYZ contract:
* https://github.com/cedriking/communityxzy-contract
* https://community.xyz/
* https://github.com/CommunityXYZ/community-js
* https://github.com/ArweaveTeam/SmartWeave/blob/master/examples/token-pst.js
*/

import { PSTContract } from './PSTContract';
import { 
  PSTCommunityContract as PSTCommunityContractBase
} from '../interfaces/PSTCommunityContract';
import { 
  PSTCommunityContractState,
  Vote
} from '../interfaces/PSTCommunityContractState';
import { _isValidArweaveAddress } from './ContractUtils';

export class PSTCommunityContract 
  extends PSTContract 
  implements PSTCommunityContractBase {
  state: PSTCommunityContractState;

  constructor(
    state: PSTCommunityContractState,
    action: ContractInteraction
  ) {
    super(state, action);
    this.state = state;
  }

  public balance(target: string|undefined): {
    result: {target: string, balance: number, ticker: string}
  } {
    const vault = this.state.vault;

    // Unlocked balance
    const { result } = this.unlockedBalance(target);
    let balance = result.balance;
    let ticker = result.ticker;
    target = result.target;

    // Add locked balance (vault)
    if (target in vault) {
      for (const v of vault[target]) {
        balance += v.balance;
      }
    }

    return { result: { target, ticker, balance }};
  }

  public unlockedBalance(target: string|undefined): {
    result: {target:string, balance:number, ticker:string}
  } {
    return super.balance(target);
  }

  lock(qty: number, lockLength: number): { state:PSTCommunityContractState } {
    const settings = this.state.settings;
    const balances = this.state.balances;
    const caller = this.caller;
    const balance = caller in balances ? balances[caller] : 0;
    const lockMinLength = settings.lockMinLength ? settings.lockMinLength : 0;
    const lockMaxLength = settings.lockMaxLength ? settings.lockMaxLength : 0;
    const vault = this.state.vault;
    const start = +SmartWeave.block.height;

    ContractAssert(
      Number.isInteger(qty) && qty > 0,
      "Quantity must be a positive integer."
    );
    ContractAssert(
      Number.isInteger(lockLength) && 
      lockLength < lockMinLength &&
      lockLength > lockMaxLength,
      `lockLength is out of range. lockLength must be between ${lockMinLength} - ${lockMaxLength}.`
    );
    ContractAssert(
      !!balance &&
      Number.isInteger(balance) &&
      balance - qty >= 0,
      "Not enough balance."
    );

    const end = start + lockLength;
    balances[caller] -= qty;
    if (caller in vault) {
      vault[caller].push({
        balance: qty,
        end,
        start
      });
    } else {
      vault[caller] = [{
        balance: qty,
        end,
        start
      }];
    }
    return { state:this.state };
  }

  public increaseVault(lockLength: number, id: number): { state:PSTCommunityContractState } {
    const settings = this.state.settings;
    const lockMinLength = settings.lockMinLength ? settings.lockMinLength : 0;
    const lockMaxLength = settings.lockMaxLength ? settings.lockMaxLength : 0;

    ContractAssert(
      Number.isInteger(lockLength) && 
      lockLength < lockMinLength &&
      lockLength > lockMaxLength,
      `lockLength is out of range. lockLength must be between ${lockMinLength} - ${lockMaxLength}.`
    );
    
    if (caller in vault) {
      if (!vault[caller][id]) {
        throw new ContractError("Invalid vault ID.");
      }
    } else {
      throw new ContractError("Caller does not have a vault.");
    }
    if (+SmartWeave.block.height >= vault[caller][id].end) {
      throw new ContractError("This vault has ended.");
    }
    vault[caller][id].end = +SmartWeave.block.height + lockLength;
    return {state};
    return { state:this.state };
  }
  unlock(): { state:PSTCommunityContractState };
  vaultBalance(target: string): {result: {target:string, balance: number, ticker:string }};
  propose(voteType: string, note: string): { state:PSTCommunityContractState };
  proposeMint(vote: Vote, recipient: string, qty: number, lockLength: number): Vote;
  proposeBurnVault(vote: Vote, target: string): Vote;
  proposeSet(vote: Vote, key: string, value:string|number): Vote;
  proposeIndicative(vote: Vote): Vote;
  vote(id: number, cast:'yay'|'nay'): { state:PSTCommunityContractState };
  finalize(id: number): { state:PSTCommunityContractState };
  role(target: string): {result: {target: string, role: string}};

}