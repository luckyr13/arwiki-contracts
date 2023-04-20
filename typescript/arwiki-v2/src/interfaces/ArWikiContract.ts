/*
* ArWiki PST Contract
*/

import { PSTCommunityContract } from './PSTCommunityContract';
import { ArWikiContractState, WritingSystem } from './ArWikiContractState';

export interface ArWikiContract extends PSTCommunityContract {
  state: ArWikiContractState;
  approvePage(
    author: string,
    pageTX: string,
    pageValue: number,
    langCode: string,
    slug: string,
    category: string
  ): { state:ArWikiContractState };
  updatePageSponsor(
    langCode: string,
    slug: string,
    pageValue: number
  ): { state:ArWikiContractState };
  stopPageSponsorshipAndDeactivatePage(langCode: string, slug: string): { state:ArWikiContractState };
  balanceDetail(target?: string): {result: {target:string, unlockedBalance:number, vaultBalance:number, stakingBalance:number, ticker:string}};
  addPageUpdate(
    langCode: string,
    slug: string,
    updateTX: string,
    author: string,
    pageValue: number,
    category: string
  ): { state:ArWikiContractState };
  addUpdateLanguage(
    method: string,
    langCode: string,
    writingSystem: WritingSystem,
    isoName: string,
    nativeName: string,
    activeLang?: boolean
  ): { state:ArWikiContractState };
  addUpdateCategory(
    method: string,
    langCode: string,
    label: string,
    slug: string,
    parent: string|null,
    order: number,
    activeCategory: boolean
  ): { state:ArWikiContractState };
  updatePageProperties(
    langCode: string,
    slug: string,
    order: number,
    showInMenu: boolean,
    showInMainPage: boolean,
    showInFooter: boolean,
    nft: string
  ): { state:ArWikiContractState };

}
