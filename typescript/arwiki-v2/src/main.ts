import { ArWikiContract } from './contract/ArWikiContract';
import { ArWikiContractState } from './interfaces/ArWikiContractState';

export async function handle(
  state: ArWikiContractState,
  action: ContractInteraction
) {
  const arwiki = new ArWikiContract(state, action);
  const input = action.input;
  const method = action.input.function;

  if (method === 'balance') {
    const target = input.target;
    return arwiki.balance(target);
  } else if (method === 'transfer') {
    const target = input.target;
    const qty = input.qty;
    return arwiki.transfer(target, qty);
  } else if (method === 'unlockedBalance') {
    const target = input.target;
    return arwiki.unlockedBalance(target);
  } else if (method === 'lock') {
    const qty = input.qty;
    const lockLength = input.lockLength;
    return arwiki.lock(qty, lockLength);
  } else if (method === 'increaseVault') {
    const id = input.id;
    const lockLength = input.lockLength;
    return arwiki.increaseVault(id, lockLength);
  } else if (method === 'unlock') {
    return arwiki.unlock();
  } else if (method === 'vaultBalance') {
    const target = input.target;
    return arwiki.vaultBalance(target);
  } else if (method === 'propose') {
    const voteType = input.type;
    const note = input.note;
    const recipient = input.recipient;
    const qty = input.qty;
    const lockLength = input.lockLength;
    const target = input.target;
    const key = input.key;
    const value = input.value;
    return arwiki.propose(
      voteType,
      note,
      recipient,
      qty,
      lockLength,
      target,
      key,
      value
    );
  } else if (method === 'vote') {
    const id = input.id;
    const cast = input.cast;
    return arwiki.vote(id, cast);
  } else if (method === 'finalize') {
    const id = input.id;
    return arwiki.finalize(id);
  } else if (method === 'role') {
    const target = input.target;
    return arwiki.role(target);
  } else if (method === 'approvePage') {
    const author = input.author;
    const pageTX = input.pageTX;
    const pageValue = input.pageValue;
    const langCode = input.langCode;
    const category = input.category;
    const slug = input.slug;
    return arwiki.approvePage(
      author,
      pageTX,
      pageValue,
      langCode,
      slug,
      category
    );
  } else if (method === 'updatePageSponsor') {
    const pageValue = input.pageValue;
    const langCode = input.langCode;
    const slug = input.slug;
    return arwiki.updatePageSponsor(
      langCode,
      slug,
      pageValue
    );
  } else if (method === 'stopPageSponsorshipAndDeactivatePage') {
    const langCode = input.langCode;
    const slug = input.slug;
    return arwiki.stopPageSponsorshipAndDeactivatePage(
      langCode,
      slug
    );
  } else if (method === 'balanceDetail') {
    const target = input.target;
    return arwiki.balanceDetail(
      target
    );
  } else if (method === 'addPageUpdate') {
    const author = input.author;
    const updateTX = input.updateTX;
    const pageValue = input.pageValue;
    const langCode = input.langCode;
    const category = input.category;
    const slug = input.slug;
    return arwiki.addPageUpdate(
      langCode,
      slug,
      updateTX,
      author,
      pageValue,
      category
    );
  } else if (method === 'addLanguage' || method === 'updateLanguage') {
    const langCode = input.langCode;
    const writingSystem = input.writingSystem;
    const isoName = input.isoName;
    const nativeName = input.nativeName;
    const activeLang = input.active;
    return arwiki.addUpdateLanguage(
      method,
      langCode,
      writingSystem,
      isoName,
      nativeName,
      activeLang
    );
  } else if (method === 'addCategory' || method === 'updateCategory') {
    const langCode = input.langCode;
    const label = input.label;
    const slug = input.slug;
    const parent = input.parent;
    const order = input.order;
    const activeCategory = input.active;
    return arwiki.addUpdateCategory(
      method,
      langCode,
      label,
      slug,
      parent,
      order,
      activeCategory
    );
  } else if (method === 'updatePageProperties') {
    const langCode = input.langCode;
    const slug = input.slug;
    const order = input.order;
    const showInMenu = input.showInMenu;
    const showInMainPage = input.showInMainPage;
    const showInFooter = input.showInFooter;
    const nft = input.nft;
    return arwiki.updatePageProperties(
      langCode,
      slug,
      order,
      showInMenu,
      showInMainPage,
      showInFooter,
      nft
    );
  } else if (method === 'evolve') {
    const value = input.value;
    return arwiki.evolve(value);
  }

	throw new ContractError(`No function supplied or function not recognised: "${input.function}"`);
}