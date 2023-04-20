import { PSTCommunityContract } from './PSTCommunityContract';
import { 
  ArWikiContract as ArWikiContractBase 
} from '../interfaces/ArWikiContract';
import { 
  ArWikiContractState,
  WritingSystem
} from '../interfaces/ArWikiContractState';
import { 
  Vote,
  VaultParams
} from '../interfaces/PSTCommunityContractState';
import { _isValidArweaveAddress } from './ContractUtils';


export class ArWikiContract 
	extends PSTCommunityContract
	implements ArWikiContractBase {
	state: ArWikiContractState;

  constructor(
    state: ArWikiContractState,
    action: ContractInteraction
  ) {
    super(state, action);
    this.state = state;
  }

  public balance(target?: string): {
    result: {target: string, balance: number, ticker: string}
  } {
    const vault = this.state.vault;
    const stakes = this.state.stakes;

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

    // Add staked balance (stakes)
    const stakingDict = stakes[target] ? stakes[target] : {};
    for (const vLang of Object.keys(stakingDict)) {
      for (const vSlug of Object.keys(stakingDict[vLang])) {
        balance += stakes[target][vLang][vSlug];
      }
    }

    return { result: { target, ticker, balance }};
  }

  public approvePage(
    author: string,
    pageTX: string,
    pageValue: number,
    langCode: string,
    slug: string,
    category: string
  ): { state:ArWikiContractState } {

  	return { state:this.state };
  }
  
  public updatePageSponsor(
    langCode: string,
    slug: string,
    pageValue: number
  ): { state:ArWikiContractState } {
  	return { state:this.state };
  }

  stopPageSponsorshipAndDeactivatePage(langCode: string, slug: string): { state:ArWikiContractState } {
  	return { state:this.state };
  }

  balanceDetail(target: string|undefined): {result: {target:string, unlockedBalance:number, vaultBalance:number, stakingBalance:number, ticker:string}} {
  	const caller = this.caller;
  	const unlockedBalance = 0;
  	const vaultBalance = 0;
  	const stakingBalance = 0;
  	const ticker = '';

  	if (!target) {
  		target = this.caller;
  	}

  	return {result: {target, unlockedBalance, vaultBalance, stakingBalance, ticker}}
  }

  public addPageUpdate(
    langCode: string,
    slug: string,
    updateTX: string,
    author: string,
    pageValue: number,
    category: string
  ): { state:ArWikiContractState } {
  	return { state:this.state };
  }

  public addLanguage(
    langCode: string,
    writingSystem: WritingSystem,
    isoName: string,
    nativeName: string
  ): { state:ArWikiContractState } {
  	return { state:this.state };
  }

  public updateLanguage(
    langCode: string,
    writingSystem: WritingSystem,
    isoName: string,
    nativeName: string,
    activeLang: boolean
  ): { state:ArWikiContractState } {
  	return { state:this.state };
  }

  addCategory(
    langCode: string,
    label: string,
    slug: string,
    parent: string|null,
    order: number
  ): { state:ArWikiContractState } {
  	return { state:this.state };
  }

  updateCategory(
    langCode: string,
    label: string,
    slug: string,
    parent: string|null,
    order: number,
    activeCategory: boolean
  ): { state:ArWikiContractState } {
  	return { state:this.state };
  }

  updatePageProperties(
    langCode: string,
    slug: string,
    order: string,
    showInMenu: boolean,
    showInMainPage: boolean,
    showInFooter: boolean,
    nft: string
  ): { state:ArWikiContractState } {
  	return { state:this.state };
  }

  // Add stakes in _calculate_total_supply
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

  // Add pageApprovalLength
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
    if (key === "quorum") {
      value = +value;
      if (isNaN(value) || value < 0.01 || value > 0.99) {
        throw new ContractError("Quorum must be between 0.01 and 0.99.");
      }
    } else if (key === "support") {
      value = +value;
      if (isNaN(value) || value < 0.01 || value > 0.99) {
        throw new ContractError("Support must be between 0.01 and 0.99.");
      }
    } else if (key === "lockMinLength") {
      value = +value;
      if (!Number.isInteger(value) || value < 1 || value >= settings.lockMaxLength) {
        throw new ContractError("lockMinLength cannot be less than 1 and cannot be equal or greater than lockMaxLength.");
      }
    } else if (key === "lockMaxLength") {
      value = +value;
      if (!Number.isInteger(value) || value <= settings.lockMinLength) {
        throw new ContractError("lockMaxLength cannot be less than or equal to lockMinLength.");
      }
    } else if (key === "pageApprovalLength") {
      value = +value;
      if (!Number.isInteger(value) || value <= 0) {
        throw new ContractError(`pageApprovalLength must be a positive integer.`);
      }
      if (value <= settings.voteLength) {
        throw new ContractError(`pageApprovalLength must be greater than voteLength ${settings.get("voteLength")}.`);
      }
    } else if (key === "voteLength") {
      value = +value;
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

  public finalize(id: number): { state:ArWikiContractState } {
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
    const stakes = this.state.stakes;

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
        let totalSupply = this._calculate_total_supply(vault, balances, stakes);
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

  public _calculate_total_supply(
    vault: Record<string, VaultParams[]>,
    balances: Record<string, number>,
    stakes?: Record<string, Record<string, Record<string, number>>>
  ) {
    let totalSupply = super._calculate_total_supply(vault, balances);
    if (stakes) {
      // Staked balances
      for (const target of Object.keys(stakes)) {
        for (const vLang of Object.keys(stakes[target])) {
          for (const vSlug of Object.keys(stakes[target][vLang])) {
            totalSupply += stakes[target][vLang][vSlug];
          }
        }
      }
    }
    
    return totalSupply;
  }


}