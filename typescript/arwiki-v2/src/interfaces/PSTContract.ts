/*
*	https://github.com/ArweaveTeam/SmartWeave/blob/master/examples/token-pst.js
*/

import { PSTContractState } from './PSTContractState';

export interface PSTContract {
	state: PSTContractState;
	action: ContractInteraction;
  input: Record<string, any>;
  caller: string;
  balance(target?: string): {result: {target:string, balance:number, ticker:string}};
	transfer(target: string, qty: number): { state:PSTContractState };
	evolve(value: string): { state:PSTContractState };
}
