import { PSTCommunityContract } from './PSTCommunityContract';
import { 
  ArWikiContract as ArWikiContractBase 
} from '../interfaces/ArWikiContract';
import { 
  ArWikiContractState,
  WritingSystem
} from '../interfaces/ArWikiContractState';
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


}