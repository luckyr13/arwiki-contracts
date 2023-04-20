/*
* Based on CommunityXYZ contract:
* https://github.com/cedriking/communityxzy-contract
* https://community.xyz/
* https://github.com/CommunityXYZ/community-js
*	https://github.com/ArweaveTeam/SmartWeave/blob/master/examples/token-pst.js
*/

import { PSTContract } from './PSTContract';
import { PSTCommunityContractState, Vote } from './PSTCommunityContractState';

export interface PSTCommunityContract extends PSTContract {
	state: PSTCommunityContractState;
	unlockedBalance(target: string|undefined): {result: {target:string, balance:number, ticker:string}};
	lock(qty: number, lockLength: number): { state:PSTCommunityContractState };
	increaseVault(lockLength: number, id: number): { state:PSTCommunityContractState };
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