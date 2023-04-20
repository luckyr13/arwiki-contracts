/*
* ArWiki PST Contract
*/

import { PSTCommunityContract } from './PSTCommunityContract';
import { PSTArWikiContractState, WritingSystem } from './PSTArWikiContractState';

export interface PSTArWikiContract extends PSTCommunityContract {
  state: PSTArWikiContractState;
  approvePage(
    author: string,
    pageTX: string,
    pageValue: number,
    langCode: string,
    slug: string,
    category: string
  ): { state:PSTArWikiContractState };
  updatePageSponsor(
    langCode: string,
    slug: string,
    pageValue: number
  ): { state:PSTArWikiContractState };
  stopPageSponsorshipAndDeactivatePage(langCode: string, slug: string): { state:PSTArWikiContractState };
  balanceDetail(target: string|undefined): {result: {target:string, unlockedBalance:number, vaultBalance:number, stakingBalance:number, ticker:string}};
  addPageUpdate(
    langCode: string,
    slug: string,
    updateTX: string,
    author: string,
    pageValue: number,
    category: string
  ): { state:PSTArWikiContractState };
  addLanguage(
    langCode: string,
    writingSystem: WritingSystem,
    isoName: string,
    nativeName: string
  ): { state:PSTArWikiContractState };
  updateLanguage(
    langCode: string,
    writingSystem: WritingSystem,
    isoName: string,
    nativeName: string,
    activeLang: boolean
  ): { state:PSTArWikiContractState };
  addCategory(
    langCode: string,
    label: string,
    slug: string,
    parent: string|null,
    order: number
  ): { state:PSTArWikiContractState };
  updateCategory(
    langCode: string,
    label: string,
    slug: string,
    parent: string|null,
    order: number,
    activeCategory: boolean
  ): { state:PSTArWikiContractState };
  updatePageProperties(
    langCode: string,
    slug: string,
    order: string,
    showInMenu: boolean,
    showInMainPage: boolean,
    showInFooter: boolean,
    nft: string
  ): { state:PSTArWikiContractState };

}
