/*
* Based on CommunityXYZ interfaces
* https://github.com/CommunityXYZ/community-js/blob/master/src/faces.ts
* https://github.com/cedriking/communityxzy-contract
*/

import { PSTContractState } from './PSTContractState';

export interface PSTCommunityContractState extends PSTContractState {
	name: string;
  votes: Vote[];
  settings: BaseCommunitySettings;
  balances: Record<string, number>;
  vault: Record<string, VaultParams[]>;
  roles: Record<string, string>;
}

export type VoteStatus = 'active' | 'quorumFailed' | 'passed' | 'failed';
export type VoteType = 'mint' | 'mintLocked' | 'burnVault' | 'indicative' | 'set';

export interface Vote {
  status: VoteStatus;
  type: VoteType;
  id?: number;
  totalWeight: number;
  recipient?: string;
  target?: string;
  qty?: number;
  key?: string;
  value?: any;
  note: string;
  yays: number;
  nays: number;
  voted: string[];
  start: number;
  lockLength?: number;
};

export interface VaultParams {
  balance: number;
  start: number;
  end: number;
}

export interface BaseCommunitySettings {
  lockMinLength: number;
  lockMaxLength: number;
  voteLength: number;
  quorum: number;
  support: number;
  communityLogo: string;
  communityDescription: string;
  communityAppUrl: string;
}