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
    const stakes = this.state.stakes;

    // Unlocked and locked balance
    const { result } = super.balance(target);
    let balance = result.balance;
    let ticker = result.ticker;
    target = result.target;

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
    const caller = this.caller;
    const roles = this.state.roles;
    const settings = this.state.settings;
    const balances = this.state.balances;
    const vault = this.state.vault;
    const stakes = this.state.stakes;
    const order = 0;
    const role = caller in roles ? roles[caller] : "";
    const start = +SmartWeave.block.height;
    const pageApprovalLength = +settings.pageApprovalLength;
    const end = start + pageApprovalLength;
    const balance = balances[caller];
    let totalSupply = this._calculate_total_supply(vault, balances, stakes);
    const value = +pageValue;
    const pageSlugMaxLength = 70;
    const pages = this.state.pages;
    const categories = this.state.categories;

    ContractAssert(
      _isValidArweaveAddress(author),
      "Invalid author."
    );
    ContractAssert(
      Number.isInteger(value) && 
      value > 0,
      '"pageValue" must be a positive integer > 0.'
    );
    ContractAssert(
      Number.isInteger(order) && 
      order >= 0,
      '"order" must be a positive integer >= 0.'
    );
    ContractAssert(
      role.trim().toUpperCase() === "MODERATOR",
      "Caller must be an admin."
    );
    ContractAssert(
      typeof langCode === 'string' &&
      !!langCode.trim().length,
      "LangCode must be specified."
    );
    ContractAssert(
      typeof slug === 'string' &&
      !!slug.trim().length,
      "Slug must be specified."
    );
    ContractAssert(
      slug.trim().length <= pageSlugMaxLength,
      `slug is longer than max allowed length ${pageSlugMaxLength}.`
    );
    ContractAssert(
      typeof category === 'string' &&
      !!category.trim().length,
      `Category must be specified.`
    );
    ContractAssert(
      typeof pageTX === 'string' &&
      !!pageTX.trim().length,
      `PageTX must be specified.`
    );
    ContractAssert(
      _isValidArweaveAddress(pageTX),
      "Invalid pageTX."
    );
    ContractAssert(
      caller in vault,
      "Caller needs to have locked balances."
    );
    
    let vaultBalance = this._get_vaultBalance(vault, caller, end);
    ContractAssert(
      vaultBalance >= value,
      `Caller doesn't have ${value} or more tokens locked for enough time (start:${start}, end:${end}, vault:${vaultBalance}).`
    );
    ContractAssert(
      Object.prototype.hasOwnProperty.call(pages, langCode),
      "Invalid LangCode (pages)!"
    );
    ContractAssert(
      Object.prototype.hasOwnProperty.call(categories, langCode),
      "Invalid LangCode (categories)!"
    );
    ContractAssert(
      !Object.prototype.hasOwnProperty.call(pages[langCode], slug),
      "Slug already taken!"
    );
    ContractAssert(
      Object.prototype.hasOwnProperty.call(categories[langCode], category),
      "Invalid Category!"
    );
    if (Object.prototype.hasOwnProperty.call(stakes, caller) &&
        Object.prototype.hasOwnProperty.call(stakes[caller], langCode) &&
        stakes[caller][langCode][slug]) {
      throw new ContractError("User is already staking on this page");
    }
    ContractAssert(
      !isNaN(balance) && balance >= value,
      "Not enough balance."
    );
    ContractAssert(
      Number.isSafeInteger(value) &&
      Number.isSafeInteger(totalSupply + value),
      "'value' too big."
    );
    // Write changes
    balances[caller] -= value;
    if (!Object.prototype.hasOwnProperty.call(stakes, caller)) {
      stakes[caller] = {};
    }
    if (!Object.prototype.hasOwnProperty.call(stakes[caller], langCode)) {
      stakes[caller][langCode] = {};
    }
    stakes[caller][langCode][slug] = value;
    if (author in vault) {
      vault[author].push({
        balance: value,
        end,
        start,
        slug,
        lang: langCode,
        action: "new"
      });
    } else {
      vault[author] = [{
        balance: value,
        end,
        start,
        slug,
        lang: langCode,
        action: "new"
      }];
    }
    pages[langCode][slug] = {
      nft: "",
      sponsor: caller,
      value,
      updates: [],
      category: category,
      order: order,
      active: true,
      showInMenu: false,
      showInFooter: false,
      showInMainPage: false
    };

    pages[langCode][slug].updates.push({
      tx: pageTX, approvedBy: caller, at: start, value
    });

  	return { state:this.state };
  }
  
  public updatePageSponsor(
    langCode: string,
    slug: string,
    pageValue: number
  ): { state:ArWikiContractState } {
    const caller = this.caller;
    const roles = this.state.roles;
    const balances = this.state.balances;
    const vault = this.state.vault;
    const stakes = this.state.stakes;
    const settings = this.state.settings;
    const pages = this.state.pages;
    const value = +pageValue;
    const role = caller in roles ? roles[caller] : "";
    const balance = +balances[caller];
    const currentHeight = +SmartWeave.block.height;
    let totalSupply = this._calculate_total_supply(vault, balances, stakes);
    const pageApprovalLength = +settings.pageApprovalLength;
    const end = currentHeight + pageApprovalLength;
    ContractAssert(
      typeof langCode === 'string' &&
      !!langCode.trim().length,
      "LangCode must be specified."
    );
    ContractAssert(
      typeof slug === 'string' &&
      !!slug.trim().length,
      "Slug must be specified."
    );
    ContractAssert(
      Object.prototype.hasOwnProperty.call(pages, langCode),
      "Invalid LangCode."
    );
    ContractAssert(
      Object.prototype.hasOwnProperty.call(pages[langCode], slug),
      "Invalid slug."
    );
    ContractAssert(
      Number.isInteger(value) && value > 0,
      '"pageValue" must be a positive integer.'
    );
    ContractAssert(
      !isNaN(balance) && balance >= value,
      `Not enough balance :: ${balance} vs ${value}`
    );
    // if (!(caller in vault)) {
    //  throw new ContractError("Caller needs to have locked balances.");
    // }
    // let vaultBalance = _get_vaultBalance(vault, caller, end);
    // if (vaultBalance < value) {
    //  throw new ContractError(`Caller doesn't have ${value} or more tokens locked for enough time  (start:${currentHeight}, end:${end}, vault:${vaultBalance}).`);
    // }
    ContractAssert(
      Number.isSafeInteger(value) &&
      Number.isSafeInteger(totalSupply + value),
      "'value' too large."
    );
    
    const previousSponsor = pages[langCode][slug].sponsor;
    const previousValue = pages[langCode][slug].value;
    if (Object.prototype.hasOwnProperty.call(stakes, caller) &&
        Object.prototype.hasOwnProperty.call(stakes[caller], langCode) &&
        stakes[caller][langCode][slug]) {
      throw new ContractError("User is already staking for this page");
    }
    ContractAssert(
      previousSponsor !== caller,
      "Caller is already staking for this page"
    );
    ContractAssert(
      value > previousValue,
      "New page value must be greater than the previous one."
    );

    // Write changes
    balances[caller] -= value;
    if (Object.prototype.hasOwnProperty.call(balances, previousSponsor) &&
      stakes[previousSponsor][langCode][slug]) {
      balances[previousSponsor] += previousValue;
      delete stakes[previousSponsor][langCode][slug];
    }

    if (!Object.prototype.hasOwnProperty.call(stakes, caller)) {
      stakes[caller] = {};
    }
    if (!Object.prototype.hasOwnProperty.call(stakes[caller], langCode)) {
      stakes[caller][langCode] = {};
    }
    stakes[caller][langCode][slug] = value;
    pages[langCode][slug].sponsor = caller;
    pages[langCode][slug].value = value;
    pages[langCode][slug].active = true;

  	return { state:this.state };
  }

  stopPageSponsorshipAndDeactivatePage(langCode: string, slug: string): { state:ArWikiContractState } {
  	const currentHeight = +SmartWeave.block.height;
    const pages = this.state.pages;
    const stakes = this.state.stakes;
    const caller = this.caller;
    const balances = this.state.balances;

    ContractAssert(
      typeof langCode === 'string' &&
      !!langCode.trim().length,
      "LangCode must be specified."
    );
    ContractAssert(
      typeof slug === 'string' &&
      !!slug.trim().length,
      "Slug must be specified."
    );
    ContractAssert(
      Object.prototype.hasOwnProperty.call(pages, langCode),
      "Invalid LangCode."
    );
    ContractAssert(
      Object.prototype.hasOwnProperty.call(pages[langCode], slug),
      "Invalid slug."
    );

    if (!Object.prototype.hasOwnProperty.call(stakes, caller) ||
        !Object.prototype.hasOwnProperty.call(stakes[caller], langCode) ||
        !stakes[caller][langCode][slug]) {
      throw new ContractError("User is not staking for this page");
    }
    const currentSponsor = pages[langCode][slug].sponsor;
    const currentValue = stakes[currentSponsor][langCode][slug];

    ContractAssert(
      currentSponsor === caller,
      "User is not the sponsor"
    );

    // Write changes
    balances[currentSponsor] += currentValue;
    delete stakes[currentSponsor][langCode][slug];

    pages[langCode][slug].sponsor = '';
    pages[langCode][slug].active = false;

    return { state:this.state };
  }

  balanceDetail(target?: string): {result: {target:string, unlockedBalance:number, vaultBalance:number, stakingBalance:number, ticker:string}} {
  	const caller = this.caller;
    const balances = this.state.balances;
    const vault = this.state.vault;
    const stakes = this.state.stakes;
    let unlockedBalance = 0;
    let vaultBalance = 0;
    let stakingBalance = 0;

  	if (!target) {
  		target = this.caller;
  	}
    ContractAssert(
      typeof target === "string",
      "Must specificy target to get balance for."
    );
    // Unlocked balance
    if (target in balances) {
      unlockedBalance = balances[target];
    }
    // Vault balance
    if (target in vault && vault[target].length) {
      try {
        vaultBalance += vault[target].map((a) => a.balance).reduce((a, b) => a + b, 0);
      } catch (e) {
      }
    }
    // Staked balance
    const stakingDict = stakes[target] ? stakes[target] : {};
    for (const vLang of Object.keys(stakingDict)) {
      for (const vSlug of Object.keys(stakingDict[vLang])) {
        stakingBalance += stakes[target][vLang][vSlug];
      }
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
    const roles = this.state.roles;
    const caller = this.caller;
    const settings = this.state.settings;
    const vault = this.state.vault;
    const role = caller in roles ? roles[caller] : "";
    const currentHeight = +SmartWeave.block.height;
    const pageApprovalLength = +settings.pageApprovalLength;
    const end = currentHeight + pageApprovalLength;
    const value = +pageValue;
    const pages = this.state.pages;
    const categories = this.state.categories;

    if (!Number.isInteger(value) || value <= 0) {
      throw new ContractError('"pageValue" must be a positive integer.');
    }
    if (typeof author !== 'string' || !author.trim().length) {
      throw new ContractError("Author address must be specified");
    }

    ContractAssert(
      typeof langCode === 'string' &&
      !!langCode.trim().length,
      "LangCode must be specified."
    );
    ContractAssert(
      typeof slug === 'string' &&
      !!slug.trim().length,
      "Slug must be specified."
    );
    ContractAssert(
      typeof updateTX === 'string' &&
      !!updateTX.trim().length,
      "updateTX must be specified."
    );
    ContractAssert(
      typeof category === 'string' &&
      !!category.trim().length,
      "category must be specified."
    );
    ContractAssert(
      Object.prototype.hasOwnProperty.call(pages, langCode),
      "Invalid LangCode (pages)."
    );
    ContractAssert(
      Object.prototype.hasOwnProperty.call(categories, langCode),
      "Invalid LangCode (categories)."
    );
    ContractAssert(
      Object.prototype.hasOwnProperty.call(pages[langCode], slug),
      "Invalid slug."
    );
    ContractAssert(
      Object.prototype.hasOwnProperty.call(categories[langCode], category),
      "Invalid Category."
    );
    ContractAssert(
      role.trim().toUpperCase() === "MODERATOR",
      "Caller must be an admin."
    );
    ContractAssert(
      pages[langCode][slug].active,
      "Page is inactive."
    );
    ContractAssert(
      caller in vault,
      "Caller needs to have locked balances."
    );
   
    let vaultBalance = this._get_vaultBalance(vault, caller, end);
    ContractAssert(
      vaultBalance >= value,
      `Caller doesn't have ${value} or more tokens locked for enough time  (start:${currentHeight}, end:${end}, vault:${vaultBalance}).`
    );

    // Write changes
    pages[langCode][slug].updates.push({
      tx: updateTX, approvedBy: caller, at: currentHeight, value
    });
    pages[langCode][slug].category = category;
    if (author in vault) {
      vault[author].push({
        balance: value,
        end,
        start: currentHeight,
        slug,
        lang: langCode,
        action: "update"
      });
    } else {
      vault[author] = [{
        balance: value,
        end,
        start: currentHeight,
        slug,
        lang: langCode,
        action: "update"
      }];
    }

  	return { state:this.state };
  }

  public addUpdateLanguage(
    method: string,
    langCode: string,
    writingSystem: WritingSystem,
    isoName: string,
    nativeName: string,
    activeLang?: boolean
  ): { state:ArWikiContractState } {
    const caller = this.caller;
    const roles = this.state.roles;
    const settings = this.state.settings;
    const balances = this.state.balances;
    const vault = this.state.vault;
    const languages = this.state.languages;
    const pages = this.state.pages;
    const categories = this.state.categories;
    const langCodeLength = 2;
    const langNameLength = 50;
    langCode = langCode.trim().toLowerCase();
    writingSystem = writingSystem.trim().toUpperCase() as WritingSystem;
    isoName = isoName.trim();
    nativeName = nativeName.trim();
    const role = caller in roles ? roles[caller] : "";
    const start = +SmartWeave.block.height;
    const pageApprovalLength = +settings.pageApprovalLength;
    const end = start + pageApprovalLength;
    const balance = balances[caller];
    const minVaultBalance = +settings.moderatorsMinVaultBalance;
    const validWritingSystems: WritingSystem[] = ['LTR', 'RTL'];

    if (method === "updateLanguage") {
      activeLang = !!activeLang;
    } else {
      activeLang = true;
    }
    ContractAssert(
      role.trim().toUpperCase() === "MODERATOR",
      "Caller must be an admin"
    );
    ContractAssert(
      typeof langCode === 'string' &&
      !!langCode.length,
      "langCode must be specified"
    );
    ContractAssert(
      langCode.length <= langCodeLength,
      `langCode is longer than max allowed length ${langCodeLength}.`
    );
    ContractAssert(
      isoName.length <= langNameLength,
      `isoName is longer than max allowed length ${langNameLength}.`
    );
    ContractAssert(
      nativeName.length <= langNameLength,
      `nativeName is longer than max allowed length ${langNameLength}.`
    );
    ContractAssert(
      validWritingSystems.indexOf(writingSystem) >= 0,
      `Invalid writing system.`
    );
    ContractAssert(
      caller in vault,
      "Caller needs to have locked balances."
    );

    let vaultBalance = this._get_vaultBalance(vault, caller, end);
    if (vaultBalance < minVaultBalance) {
      throw new ContractError(`Caller doesn't have ${minVaultBalance} or more tokens locked for enough time (start:${start}, end:${end}, vault:${vaultBalance}).`);
    }
    if (method === "addLanguage" &&
        Object.prototype.hasOwnProperty.call(languages, langCode)) {
      throw new ContractError("LangCode already exists!"); 
    } else if (method === "updateLanguage" &&
        !Object.prototype.hasOwnProperty.call(languages, langCode)) {
      throw new ContractError("LangCode does not exist!"); 
    }
    // Write changes
    languages[langCode] = {
      "active": activeLang,
      "iso_name": isoName,
      "native_name": nativeName,
      "writing_system": writingSystem
    };
    if (method === "addLanguage") {
      pages[langCode] = {};
      categories[langCode] = {};
    }
  	return { state:this.state };
  }

  public addUpdateCategory(
    method: string,
    langCode: string,
    label: string,
    slug: string,
    parent: string|null,
    order: number,
    activeCategory?: boolean
  ): { state:ArWikiContractState } {
    const caller = this.caller;
    const roles = this.state.roles;
    const settings = this.state.settings;
    const balances = this.state.balances;
    const categories = this.state.categories;
    const vault = this.state.vault;
    const categoryLabelLength = 50;
    const categorySlugMaxLength = 50;
    langCode = langCode.trim().toLowerCase();
    label = label.trim();
    slug = slug.trim();
    parent = parent && parent.trim() ? parent.trim() : null;
    const role = caller in roles ? roles[caller] : "";
    order = +order;
    const start = +SmartWeave.block.height;
    const pageApprovalLength = +settings.pageApprovalLength;
    const end = start + pageApprovalLength;
    const balance = balances[caller];
    const minVaultBalance = +settings.moderatorsMinVaultBalance;
    if (method === "updateCategory") {
      activeCategory = !!activeCategory;
    } else {
      activeCategory = true;
    }
    ContractAssert(
      role.trim().toUpperCase() === "MODERATOR",
      "Caller must be an admin"
    );
    ContractAssert(
      typeof langCode === 'string' && 
      !!langCode.length,
      "langCode must be specified"
    );
    ContractAssert(
      Object.prototype.hasOwnProperty.call(categories, langCode),
      "LangCode does not exist! ${langCode}"
    );
    ContractAssert(
      label.length <= categoryLabelLength,
      `label is longer than max allowed length ${categoryLabelLength}.`
    );
    ContractAssert(
      slug.length <= categorySlugMaxLength,
      `slug is longer than max allowed length ${categorySlugMaxLength}.`
    );

    if (parent && !(parent in categories[langCode])) {
      throw new ContractError(`Parent id is not a valid category ${parent}.`)
    }
    ContractAssert(
      Number.isInteger(order) && order >= 0,
      '"order" must be a positive integer.'
    );
    ContractAssert(
      caller in vault,
      "Caller needs to have locked balances."
    );
    
    let vaultBalance = this._get_vaultBalance(vault, caller, end);
    if (vaultBalance < minVaultBalance) {
      throw new ContractError(`Caller doesn't have ${minVaultBalance} or more tokens locked for enough time (start:${start}, end:${end}, vault:${vaultBalance}).`);
    }
    if (method === "addCategory" &&
        Object.prototype.hasOwnProperty.call(categories[langCode], slug)) {
      throw new ContractError("Category already exists!"); 
    } else if (method === "updateCategory" &&
        !Object.prototype.hasOwnProperty.call(categories[langCode], slug)) {
      throw new ContractError("Category does not exist!"); 
    }
    ContractAssert(
      slug !== parent,
      "Slug and parent_id must be different!"
    );
    // Write changes
    categories[langCode][slug] = {
      label: label,
      order: order,
      active: activeCategory,
      parent_id: parent
    };

  	return { state:this.state };
  }

  public updatePageProperties(
    langCode: string,
    slug: string,
    order: number,
    showInMenu: boolean,
    showInMainPage: boolean,
    showInFooter: boolean,
    nft: string
  ): { state:ArWikiContractState } {
    const caller = this.caller;
    const roles = this.state.roles;
    const settings = this.state.settings;
    const balances = this.state.balances;
    const pages = this.state.pages;
    const vault = this.state.vault;
    langCode = langCode.trim().toLowerCase();
    slug = slug.trim();
    const role = caller in roles ? roles[caller] : "";
    order = +order;
    const start = +SmartWeave.block.height;
    const pageApprovalLength = +settings.pageApprovalLength;
    const end = start + pageApprovalLength;
    const balance = balances[caller];
    const minVaultBalance = +settings.moderatorsMinVaultBalance;
    showInMenu = !!showInMenu;
    showInMainPage = !!showInMainPage;
    showInFooter = !!showInFooter;
    nft = nft.trim();
    ContractAssert(
      role.trim().toUpperCase() === "MODERATOR",
      "Caller must be an admin"
    );
    ContractAssert(
      typeof langCode === 'string' &&
      !!langCode.length,
      "langCode must be specified"
    );
    ContractAssert(
      Object.prototype.hasOwnProperty.call(pages, langCode),
      "LangCode does not exist! ${langCode}"
    );
    ContractAssert(
      Number.isInteger(order) && order >= 0,
      '"order" must be a positive integer.'
    );
    ContractAssert(
      caller in vault,
      "Caller needs to have locked balances."
    );

    let vaultBalance = this._get_vaultBalance(vault, caller, end);
    ContractAssert(
      vaultBalance >= minVaultBalance,
      `Caller doesn't have ${minVaultBalance} or more tokens locked for enough time (start:${start}, end:${end}, vault:${vaultBalance}).`
    );
    ContractAssert(
      Object.prototype.hasOwnProperty.call(pages[langCode], slug),
      "Page does not exist!"
    );
    
    if (nft && !_isValidArweaveAddress(nft)) {
      throw new ContractError("Invalid NFT address!"); 
    }

    // Write changes
    pages[langCode][slug].order = order;
    pages[langCode][slug].nft = nft;
    pages[langCode][slug].showInMenu = showInMenu;
    pages[langCode][slug].showInMainPage = showInMainPage;
    pages[langCode][slug].showInFooter = showInFooter;

  	return { state:this.state };
  }

  // Override parent method
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
    const stakes = this.state.stakes;
    let totalSupply = this._calculate_total_supply(vault, balances, stakes);

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

  // Override parent method
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

  // Override parent method
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

  // Override parent method
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

  public _get_vaultBalance(
    vault: Record<string, VaultParams[]>,
    caller: string,
    end:number
  ) {
    let vaultBalance = 0;
    const filtered = vault[caller].filter((a) => a.end > end && a.start <= end);
    for (let i = 0, j = filtered.length; i < j; i++) {
      vaultBalance += filtered[i].balance;
    }
    return vaultBalance;
  }


}