/*
* ArWiki Contract State
*/

import { PSTCommunityContractState, VaultParams } from './PSTCommunityContractState';

export interface PSTArWikiContractState extends PSTCommunityContractState {
	pages: Record<string, Record<string, ArWikiPageProperties>>;
  categories: Record<string, Record<string, ArWikiCategory>>;
  languages: Record<string, ArWikiLanguage>;
  stakes: Record<string, Record<string, Record<string, number>>>;
  vault: Record<string, ArWikiVaultParams[]>;

}

export interface ArWikiPageProperties {
  nft: string;
  order: number;
  value: number;
  sponsor: string;
  category: string;
  showInMenu: boolean;
  showInFooter: boolean;
  showInMainPage: boolean;
  updates: ArWikiPageUpdate[];
  active: boolean;
}

export interface ArWikiPageUpdate {
  at: number;
  tx: string;
  value: number;
  approvedBy: string;
}

export interface ArWikiCategory {
  label: string;
  order: number;
  parent_id: string|null;
  active: boolean;
}

export interface ArWikiLanguage {
  iso_name: string;
  native_name: string;
  writing_system: WritingSystem;
  active: boolean;
}

export interface ArWikiVaultParams extends VaultParams {
  lang?: string;
  slug?: string;
  action?: 'new'|'update';
}

export type WritingSystem = 'RTL'|'LTR';