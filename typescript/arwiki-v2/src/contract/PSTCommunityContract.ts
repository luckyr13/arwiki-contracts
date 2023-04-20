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
  Vote,
  VaultParams,
  VoteType
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

  public balance(target?: string): {
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

  public unlockedBalance(target?: string): {
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
      lockLength >= lockMinLength &&
      lockLength <= lockMaxLength,
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
    const vault = this.state.vault;
    const caller = this.caller;
    const currentHeight = +SmartWeave.block.height;

    ContractAssert(
      Number.isInteger(lockLength) && 
      lockLength >= lockMinLength &&
      lockLength <= lockMaxLength,
      `lockLength is out of range. lockLength must be between ${lockMinLength} - ${lockMaxLength}.`
    );
    ContractAssert(
      caller in vault,
      "Caller does not have a vault."
    );
    ContractAssert(
      !!vault[caller][id],
      "Invalid vault ID."
    );
    ContractAssert(
      currentHeight < vault[caller][id].end,
      "This vault has ended."
    );
    
    vault[caller][id].end = currentHeight + lockLength;

    return { state:this.state };
  }

  public unlock(): { state:PSTCommunityContractState } {
    const caller = this.caller;
    const vault = this.state.vault;
    const balances = this.state.balances;
    const currentHeight = +SmartWeave.block.height;

    if (caller in vault && vault[caller].length) {
      let i = vault[caller].length;
      while (i--) {
        const locked = vault[caller][i];
        if (currentHeight >= locked.end) {
          if (caller in balances && typeof balances[caller] === "number") {
            balances[caller] += locked.balance;
          } else {
            balances[caller] = locked.balance;
          }
          vault[caller].splice(i, 1);
        }
      }
    }

    return { state:this.state };
  }

  public vaultBalance(target?: string): {result: {target:string, balance: number, ticker:string }} {
    let balance = 0;
    const vault = this.state.vault;
    const currentHeight = +SmartWeave.block.height;
    const ticker = this.state.ticker;
    const caller = this.caller;

    // Is target defined?
    if (!target) {
      target = caller;
    }
    if (target in vault) {
      const filtered = vault[target].filter((a) => currentHeight < a.end);
      for (let i = 0, j = filtered.length; i < j; i++) {
        balance += filtered[i].balance;
      }
    }
    return {result: {target, balance, ticker}};
  }

  public propose(
    voteType: VoteType,
    note: string,
    recipient?: string,
    qty?: number,
    lockLength?: number,
    target?: string,
    key?: string,
    value?: string|number): { state:PSTCommunityContractState } {
    const noteVoteMaxLength = 200;
    const caller = this.caller;
    const vault = this.state.vault;
    const settings = this.state.settings;
    const votes = this.state.votes;

    ContractAssert(
      typeof note === "string",
      "Note format not recognized."
    );
    // Trim note
    note = note.trim();

    ContractAssert(
      note.length <= noteVoteMaxLength,
      `Note length is longer than the max allowed length ${noteVoteMaxLength}.`
    );
    ContractAssert(
      caller in vault,
      "Caller needs to have locked balances."
    );

    const hasBalance = vault[caller] && !!vault[caller].filter((a) => a.balance > 0).length;
    ContractAssert(
      hasBalance,
      "Caller doesn't have any locked balance."
    );

    // Validate lock time
    const start = +SmartWeave.block.height;
    const end = start + (+settings.voteLength);
    const vaultBalance = this._get_vaultBalance(vault, caller, end);
    ContractAssert(
      !vaultBalance,
      `Caller doesn't have tokens locked for enough time (start:${start}, end:${end}, vault:${vaultBalance}).`
    );
    
    // Total weight
    let totalWeight = 0;
    const vaultValues = Object.values(vault);
    for (let i = 0, j = vaultValues.length; i < j; i++) {
      const locked = vaultValues[i];
      for (let j2 = 0, k = locked.length; j2 < k; j2++) {
        totalWeight += locked[j2].balance * (locked[j2].end - locked[j2].start);
      }
    }
    let vote: Vote = {
      status: "active",
      type: voteType,
      note,
      yays: 0,
      nays: 0,
      voted: [],
      start: start,
      totalWeight
    };
    if (voteType === "mint" || voteType === "mintLocked") {
      vote = this.proposeMint(vote, recipient, qty, lockLength);
      votes.push(vote);
    } else if (voteType === "burnVault") {
      vote = this.proposeBurnVault(vote, target);
      votes.push(vote);
    } else if (voteType === "set") {
      vote = this.proposeSet(vote, key, value, recipient);
      votes.push(vote);
    } else if (voteType === "indicative") {
      votes.push(vote);
    } else {
      throw new ContractError("Invalid vote type.");
    }

    return { state: this.state };
  }

  public proposeMint(
    vote: Vote,
    recipient?: string,
    qty?: number,
    lockLength?: number): Vote {
    const vault = this.state.vault;
    const balances = this.state.balances;
    const settings = this.state.settings;
    const lockMinLength = settings.lockMinLength ? settings.lockMinLength : 0;
    const lockMaxLength = settings.lockMaxLength ? settings.lockMaxLength : 0;
    let totalSupply = this._calculate_total_supply(vault, balances);

    if (!recipient) {
      throw new ContractError("No recipient specified");
    }
    if (!qty) {
      throw new ContractError("No qty specified");
    }
    ContractAssert(
      _isValidArweaveAddress(recipient),
      "Invalid recipient."
    );
    ContractAssert(
      Number.isInteger(qty) && qty > 0,
      'Invalid value for "qty". Must be a positive integer.'
    );
    ContractAssert(
      Number.isSafeInteger(totalSupply + qty) &&
      Number.isSafeInteger(qty),
      "Quantity too large."
    );

    let lockLengthObj = {};
    if (lockLength) {
      ContractAssert(
        Number.isInteger(lockLength) && 
        lockLength >= lockMinLength &&
        lockLength <= lockMaxLength,
        `lockLength is out of range. lockLength must be between ${lockMinLength} - ${lockMaxLength}.`
      );

      lockLengthObj = {lockLength: lockLength};
    }
    Object.assign(vote, {
      recipient,
      qty
    }, lockLengthObj);

    return vote;
  }

  public proposeBurnVault(vote: Vote, target?: string): Vote {
    if (!target || typeof target !== "string") {
      throw new ContractError("Target is required.");
    }
    ContractAssert(
      _isValidArweaveAddress(target),
      "Invalid target."
    );
    Object.assign(vote, {
      target
    });
    return vote;
  }

  public proposeSet(
    vote: Vote,
    key?: string,
    value?:string|number,
    recipient?:string): Vote {
    const settings = this.state.settings;
    const roleValueVoteMaxLength = 50;
    const keyVoteMaxLength = 50;
    const keyStringValueVoteMaxLength = 50;

    if (typeof key !== "string") {
      throw new ContractError("Data type of key not supported.");
    }
    if (!value) {
      throw new ContractError("Value is undefined.");
    }
    if (key === "quorum" || key === "support" || 
       key === "lockMinLength" ||
       key === "lockMaxLength" || 
       key === "voteLength") {
      value = +value;
    }
    if (key === "quorum") {
      if (isNaN(+value) || value < 0.01 || value > 0.99) {
        throw new ContractError("Quorum must be between 0.01 and 0.99.");
      }
    } else if (key === "support") {
      if (isNaN(+value) || value < 0.01 || value > 0.99) {
        throw new ContractError("Support must be between 0.01 and 0.99.");
      }
    } else if (key === "lockMinLength") {
      if (!Number.isInteger(value) || value < 1 || value >= settings.lockMaxLength) {
        throw new ContractError("lockMinLength cannot be less than 1 and cannot be equal or greater than lockMaxLength.");
      }
    } else if (key === "lockMaxLength") {
      if (!Number.isInteger(value) || value <= settings.lockMinLength) {
        throw new ContractError("lockMaxLength cannot be less than or equal to lockMinLength.");
      }
    } else if (key === "voteLength") {
      if (!Number.isInteger(value) || value <= 0) {
        throw new ContractError("voteLength must be > 0");
      }
    }
    if (key === "role") {
      if (!recipient) {
        throw new ContractError("No recipient specified");
      }
      if (!_isValidArweaveAddress(recipient)) {
        throw new ContractError("Invalid recipient.");
      }
      if (typeof value !== 'string') {
        throw new ContractError(`value must be a string.`);
      }
      if (value.trim().length > roleValueVoteMaxLength) {
        throw new ContractError(`value for role is longer than max allowed length ${roleValueVoteMaxLength}.`);
      }
      Object.assign(vote, {
        key: key,
        value: value.trim(),
        recipient
      });
    } else {
      if (typeof key !== 'string') {
        throw new ContractError(`key must be a string.`);
      }
      if (!key.trim()) {
        throw new ContractError(`You must provide a value for key.`);
      }
      if (key.trim().length > keyVoteMaxLength) {
        throw new ContractError(`Key length is longer than max allowed length ${keyVoteMaxLength}`);
      }
      // Assign value
      if (typeof value === 'string' &&
        value.trim().length > keyStringValueVoteMaxLength) {
        throw new ContractError(`value exceeds max length ${keyStringValueVoteMaxLength}`);
      } else if (typeof value === 'string') {
        Object.assign(vote, {
          key: key.trim(),
          value: value.trim()
        });
      } else if (typeof value === 'number') {
        Object.assign(vote, {
          key: key.trim(),
          value: +value
        });
      } else {
        throw new ContractError('Unknown value type');
      }
    }
    return vote;
  }
  
  public vote(id: number, cast:'yay'|'nay'): { state:PSTCommunityContractState } {
    const votes = this.state.votes;
    const caller = this.caller;
    const vault = this.state.vault;
    const voteLength = this.state.settings.voteLength ?
      this.state.settings.voteLength :
      0;

    ContractAssert(
      Number.isInteger(id),
      'Invalid value for "id". Must be an integer.'
    );

    const vote = votes[id];
    let voterBalance = 0;
    if (caller in vault) {
      for (let i = 0, j = vault[caller].length; i < j; i++) {
        const locked = vault[caller][i];
        if (locked.start < vote.start && locked.end >= vote.start) {
          voterBalance += locked.balance * (locked.end - locked.start);
        }
      }
    }

    ContractAssert(
      voterBalance > 0,
      "Caller does not have locked balances for this vote."
    );
    ContractAssert(
      !vote.voted.includes(caller),
      "Caller has already voted."
    );
    ContractAssert(
      +SmartWeave.block.height >= vote.start + voteLength,
      "Vote has already concluded."
    );

    if (cast === "yay") {
      vote.yays += voterBalance;
    } else if (cast === "nay") {
      vote.nays += voterBalance;
    } else {
      throw new ContractError("Vote cast type unrecognised.");
    }
    vote.voted.push(caller);

    return { state: this.state };
  }

  public finalize(id: number): { state:PSTCommunityContractState } {
    const settings = this.state.settings;
    const roles = this.state.roles;
    const votes = this.state.votes;
    const vote = votes[id];
    const qty = vote.qty;
    const voteLength = this.state.settings.voteLength ?
      this.state.settings.voteLength :
      0;
    const quorum = this.state.settings.quorum ?
      this.state.settings.quorum :
      0;
    const support = this.state.settings.support ?
      this.state.settings.support :
      0;
    const vault = this.state.vault;
    const balances = this.state.balances;

    if (!vote) {
      throw new ContractError("This vote doesn't exists.");
    }
    if (+SmartWeave.block.height < vote.start + voteLength) {
      throw new ContractError("Vote has not yet concluded.");
    }
    if (vote.status !== "active") {
      throw new ContractError("Vote is not active.");
    }
    if (vote.totalWeight * quorum > vote.yays + vote.nays) {
      vote.status = "quorumFailed";
      return { state:this.state };
    }
    if (vote.yays !== 0 && (vote.nays === 0 || vote.yays / vote.nays > support)) {
      vote.status = "passed";
      if (vote.type === "mint" || vote.type === "mintLocked") {
        let totalSupply = this._calculate_total_supply(vault, balances);
        if (!qty) {
          throw new ContractError('qty is undefined');
        }
        if (!Number.isSafeInteger(totalSupply + qty)) {
          throw new ContractError("Quantity too large.");
        }
      }
      if (vote.type === "mint") {
        if (!qty) {
          throw new ContractError('qty is undefined');
        }
        if (!vote.recipient) {
          throw new ContractError("vote.recipient is undefined.");
        }
        if (vote.recipient in balances) {
          balances[vote.recipient] += qty;
        } else {
          balances[vote.recipient] = qty;
        }
      } else if (vote.type === "mintLocked") {
        if (!vote.lockLength) {
          throw new ContractError('vote.lockLength is undefined');
        }
        if (!vote.recipient) {
          throw new ContractError("vote.recipient is undefined.");
        }
        if (!qty) {
          throw new ContractError('qty is undefined');
        }

        const start = +SmartWeave.block.height;
        const end = start + vote.lockLength;
        const locked = {
          balance: qty,
          start,
          end
        };
        if (vote.recipient in vault) {
          vault[vote.recipient].push(locked);
        } else {
          vault[vote.recipient] = [locked];
        }
      } else if (vote.type === "burnVault") {
        if (!vote.target) {
          throw new ContractError('vote.target is undefined');
        }

        if (vote.target in vault) {
          delete vault[vote.target];
        } else {
          vote.status = "failed";
        }
      } else if (vote.type === "set") {
        if (vote.key === "role") {
          if (!vote.recipient) {
            throw new ContractError('vote.recipient is undefined');
          }
          roles[vote.recipient] = vote.value;
        } else {
          if (!vote.key) {
            throw new ContractError('vote.key is undefined');
          }
          settings[vote.key] = vote.value;
        }
      }
    } else {
      vote.status = "failed";
    }

    return { state:this.state };
  }

  public role(target: string): {result: {target: string, role: string}} {
    const caller = this.caller;
    const roles = this.state.roles;

    // Is target defined?
    if (!target) {
      target = caller;
    }
    const role = target in roles ? roles[target] : "";
    if (!role.trim().length) {
      throw new Error("Target doesn't have a role specified.");
    }
    return {result: {target, role}};
  }

  
  public _get_vaultBalance(
    vault: Record<string, VaultParams[]>,
    caller: string,
    end: number
  ): number {
    let vaultBalance = 0;
    const filtered = vault[caller].filter((a) => a.end > end && a.start <= end);
    for (let i = 0, j = filtered.length; i < j; i++) {
      vaultBalance += filtered[i].balance;
    }
    return vaultBalance;
  }

  public _calculate_total_supply(
    vault: Record<string, VaultParams[]>,
    balances: Record<string, number>
  ) {
    // Vault
    const vaultValues2 = Object.values(vault);
    let totalSupply = 0;
    for (let i = 0, j = vaultValues2.length; i < j; i++) {
      const locked = vaultValues2[i];
      for (let j2 = 0, k = locked.length; j2 < k; j2++) {
        totalSupply += locked[j2].balance;
      }
    }
    // Unlocked balances
    const balancesValues = Object.values(balances);
    for (let i = 0, j = balancesValues.length; i < j; i++) {
      totalSupply += balancesValues[i];
    }
    return totalSupply;
  }

  

}