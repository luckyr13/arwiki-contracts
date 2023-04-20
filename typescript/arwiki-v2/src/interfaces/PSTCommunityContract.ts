/*
* Based on CommunityXYZ contract:
* https://github.com/cedriking/communityxzy-contract
* https://community.xyz/
* https://github.com/CommunityXYZ/community-js
*	https://github.com/ArweaveTeam/SmartWeave/blob/master/examples/token-pst.js
*/

import { PSTContract } from './PSTContract';
import {
	PSTCommunityContractState,
	Vote,
	VaultParams,
	VoteType
} from './PSTCommunityContractState';

export interface PSTCommunityContract extends PSTContract {
	state: PSTCommunityContractState;
	unlockedBalance(target?: string): {result: {target:string, balance:number, ticker:string}};
	lock(qty: number, lockLength: number): { state:PSTCommunityContractState };
	increaseVault(lockLength: number, id: number): { state:PSTCommunityContractState };
	unlock(): { state:PSTCommunityContractState };
	vaultBalance(target?: string): {result: {target:string, balance: number, ticker:string }};
	propose(
		voteType: VoteType,
		note: string,
    recipient?: string,
    qty?: number,
    lockLength?: number
	): { state:PSTCommunityContractState };
	proposeMint(
		vote: Vote,
		recipient?: string,
		qty?: number,
		lockLength?: number): Vote;
	proposeBurnVault(vote: Vote, target?: string): Vote;
	proposeSet(
		vote: Vote,
		key?: string,
		value?: string|number,
		recipient?: string): Vote;
	vote(id: number, cast:'yay'|'nay'): { state:PSTCommunityContractState };
	finalize(id: number): { state:PSTCommunityContractState };
	role(target: string): {result: {target: string, role: string}};
	_get_vaultBalance(
		vault: Record<string, VaultParams[]>,
		caller: string,
		end: number
	): number;
	_calculate_total_supply(
    vault: Record<string, VaultParams[]>,
    balances: Record<string, number>
  ): number;
}