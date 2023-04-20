/*
* Based on Smartweave > PST Contract
*	https://github.com/ArweaveTeam/SmartWeave/blob/master/examples/token-pst.js
*/

import { 
	PSTContract as PSTContractInterface 
} from '../interfaces/PSTContract';
import { PSTContractState } from '../interfaces/PSTContractState';
import { _isValidArweaveAddress } from './ContractUtils';

export class PSTContract implements PSTContractInterface {
	state: PSTContractState;
	action: ContractInteraction;
  input: Record<string, any>;
  caller: string;

	constructor(state: PSTContractState, action: ContractInteraction) {
		this.state = state;
		this.action = action;
		this.input = this.action.input;
		this.caller = this.action.caller;
	}

  public balance(target: string|undefined): {
    result: {target: string, balance: number, ticker: string}
  } {
    const ticker = this.state.ticker;
    let balance = 0;
    const balances = this.state.balances;

    // Is target defined?
    if (!target) {
      target = this.caller;
    }

    // Validate target
    ContractAssert(
      typeof target === 'string',
      `Invalid type for target.`
    );
    ContractAssert(
      _isValidArweaveAddress(target),
      `Invalid target address.`
    );

    // Get balance
    if (target in balances) {
      balance = balances[target];
    }

    return { result: { target, ticker, balance }};
  }

	public transfer(target: string, qty: number): { 
		state:PSTContractState 
	} {
		const balances = this.state.balances;
    const caller = this.caller;

    // Does qty has a valid type?
    ContractAssert(
      Number.isInteger(qty),
      `Invalid type for qty.`
    );
    ContractAssert(
      Number.isSafeInteger(qty),
      `qty is too big.`
    );
    ContractAssert(
      qty > 0,
      `qty is less than or equal to zero.`
    );

    // Is target a valid address?
    ContractAssert(
      typeof target === 'string',
      `Invalid type for target.`
    );
    ContractAssert(
      !!target,
      `Target must be defined.`
    );
    ContractAssert(
      _isValidArweaveAddress(target),
      `Invalid target address.`
    );
    ContractAssert(
      target !== caller,
      `The caller cannot be the target.`
    );

    // Does caller have enough balance?
    ContractAssert(
      caller in balances,
      `Caller does not have balance.`
    );
    ContractAssert(
      balances[caller] - qty >= 0,
      `Caller does not have enough balance.`
    );

    if (!(target in balances)) {
      balances[target] = 0;
    }

    // Is the transfer valid?
    ContractAssert(
      Number.isSafeInteger(balances[target] + qty),
      `Final balance for target is too big.`
    );

    // Do the transfer
    balances[caller] -= qty;
    balances[target] += qty;

    return { state: this.state };
	}

  /*
  *  More information on:
  *  https://academy.warp.cc/docs/sdk/basic/evolve#evolve-1
  */
  public evolve(value: string): { state:PSTContractState } {
    const canEvolve = this.state.canEvolve;
    const owner = this.state.owner;
    const caller = this.caller;

    if (canEvolve) {
      ContractAssert(
        owner === caller,
        `Only the owner can evolve a contract.`
      );
      this.state.evolve = value;
    }

    return { state:this.state };
  }


}