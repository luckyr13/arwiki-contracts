/*
* Based on CommunityXYZ contract:
* https://github.com/cedriking/communityxzy-contract
* ArWiki v2
* DEPRECATED
* Please use Typescript contract version
*/
export function handle(state, action) {
  const settings = new Map(state.settings);
  const balances = state.balances;
  const vault = state.vault;
  const votes = state.votes;
  const input = action.input;
  const caller = action.caller;
  const stakes = state.stakes;
  const pages = state.pages;
  const categories = state.categories;
  const languages = state.languages;
  const langCodeLength = 2;
  const langNameLength = 50;
  const validWritingSystems = ['LTR', 'RTL'];
  const noteVoteMaxLength = 200;
  const keyStringValueVoteMaxLength = 50;
  const keyVoteMaxLength = 50;
  const roleValueVoteMaxLength = 50;
  const pageSlugMaxLength = 70;
  const categoryLabelLength = 50;
  const categorySlugMaxLength = 50;
  

  if (input.function === "transfer") {
    const target = input.target;
    const qty = input.qty;
    if (!Number.isInteger(qty)) {
      throw new ContractError('Invalid value for "qty". Must be an integer.');
    }
    if (!target) {
      throw new ContractError("No target specified.");
    }
    if (!_is_valid_arweaveAddress(target)) {
      throw new ContractError("Invalid target.");
    }
    if (qty <= 0 || caller === target) {
      throw new ContractError("Invalid token transfer.");
    }
    if (!(caller in balances)) {
      throw new ContractError("Caller doesn't own any DAO balance.");
    }
    if (balances[caller] < qty) {
      throw new ContractError(`Caller balance not high enough to send ${qty} token(s)!`);
    }
    balances[caller] -= qty;
    if (target in balances) {
      balances[target] += qty;
    } else {
      balances[target] = qty;
    }
    return {state};
  }
  if (input.function === "balance") {
    const target = input.target || caller;
    if (typeof target !== "string") {
      throw new ContractError("Must specificy target to get balance for.");
    }
    let balance = 0;
    if (target in balances) {
      balance = balances[target];
    }
    if (target in vault && vault[target].length) {
      try {
        balance += vault[target].map((a) => a.balance).reduce((a, b) => a + b, 0);
      } catch (e) {
      }
    }
    const stakingDict = stakes[target] ? stakes[target] : {};
    for (const vLang of Object.keys(stakingDict)) {
      for (const vSlug of Object.keys(stakingDict[vLang])) {
        balance += stakes[target][vLang][vSlug];
      }
    }
    
    return {result: {target, balance}};
  }
  if (input.function === "unlockedBalance") {
    const target = input.target || caller;
    if (typeof target !== "string") {
      throw new ContractError("Must specificy target to get balance for.");
    }
    if (!(target in balances)) {
      throw new ContractError("Cannnot get balance, target does not exist.");
    }
    let balance = balances[target];
    return {result: {target, balance}};
  }
  if (input.function === "lock") {
    const qty = input.qty;
    const lockLength = input.lockLength;
    if (!Number.isInteger(qty) || qty <= 0) {
      throw new ContractError("Quantity must be a positive integer.");
    }
    if (!Number.isInteger(lockLength) || lockLength < settings.get("lockMinLength") || lockLength > settings.get("lockMaxLength")) {
      throw new ContractError(`lockLength is out of range. lockLength must be between ${settings.get("lockMinLength")} - ${settings.get("lockMaxLength")}.`);
    }
    const balance = balances[caller];
    if (isNaN(balance) || balance < qty) {
      throw new ContractError("Not enough balance.");
    }
    balances[caller] -= qty;
    const start = +SmartWeave.block.height;
    const end = start + lockLength;
    if (caller in vault) {
      vault[caller].push({
        balance: qty,
        end,
        start
      });
    } else {
      vault[caller] = [{
        balance: qty,
        end,
        start
      }];
    }
    return {state};
  }
  if (input.function === "increaseVault") {
    const lockLength = input.lockLength;
    const id = input.id;
    if (!Number.isInteger(lockLength) || lockLength < settings.get("lockMinLength") || lockLength > settings.get("lockMaxLength")) {
      throw new ContractError(`lockLength is out of range. lockLength must be between ${settings.get("lockMinLength")} - ${settings.get("lockMaxLength")}.`);
    }
    if (caller in vault) {
      if (!vault[caller][id]) {
        throw new ContractError("Invalid vault ID.");
      }
    } else {
      throw new ContractError("Caller does not have a vault.");
    }
    if (+SmartWeave.block.height >= vault[caller][id].end) {
      throw new ContractError("This vault has ended.");
    }
    vault[caller][id].end = +SmartWeave.block.height + lockLength;
    return {state};
  }
  if (input.function === "unlock") {
    if (caller in vault && vault[caller].length) {
      let i = vault[caller].length;
      while (i--) {
        const locked = vault[caller][i];
        if (+SmartWeave.block.height >= locked.end) {
          if (caller in balances && typeof balances[caller] === "number") {
            balances[caller] += locked.balance;
          } else {
            balances[caller] = locked.balance;
          }
          vault[caller].splice(i, 1);
        }
      }
    }
    return {state};
  }
  if (input.function === "vaultBalance") {
    const target = input.target || caller;
    let balance = 0;
    if (target in vault) {
      const blockHeight = +SmartWeave.block.height;
      const filtered = vault[target].filter((a) => blockHeight < a.end);
      for (let i = 0, j = filtered.length; i < j; i++) {
        balance += filtered[i].balance;
      }
    }
    return {result: {target, balance}};
  }
  if (input.function === "propose") {
    const voteType = input.type;
    if (typeof input.note !== "string") {
      throw new ContractError("Note format not recognized.");
    }
    const note = input.note.trim();
    if (note.length > noteVoteMaxLength) {
      throw new ContractError(`Note length is longer than the max allowed length ${noteVoteMaxLength}.`);
    }
    if (!(caller in vault)) {
      throw new ContractError("Caller needs to have locked balances.");
    }
    const hasBalance = vault[caller] && !!vault[caller].filter((a) => a.balance > 0).length;
    if (!hasBalance) {
      throw new ContractError("Caller doesn't have any locked balance.");
    }
    // Validate lock time
    const start = +SmartWeave.block.height;
    const end = start + (+settings.get("voteLength"));
    const vaultBalance = _get_vaultBalance(vault, caller, end);
    if (!vaultBalance) {
      throw new ContractError(`Caller doesn't have tokens locked for enough time (start:${start}, end:${end}, vault:${vaultBalance}).`);
    }
    
    let totalWeight = 0;
    const vaultValues = Object.values(vault);
    for (let i = 0, j = vaultValues.length; i < j; i++) {
      const locked = vaultValues[i];
      for (let j2 = 0, k = locked.length; j2 < k; j2++) {
        totalWeight += locked[j2].balance * (locked[j2].end - locked[j2].start);
      }
    }
    let vote = {
      status: "active",
      type: voteType,
      note,
      yays: 0,
      nays: 0,
      voted: [],
      start: +SmartWeave.block.height,
      totalWeight
    };
    if (voteType === "mint" || voteType === "mintLocked") {
      const recipient = input.recipient;
      const qty = +input.qty;
      if (!recipient) {
        throw new ContractError("No recipient specified");
      }
      if (!_is_valid_arweaveAddress(recipient)) {
        throw new ContractError("Invalid recipient.");
      }
      if (!Number.isInteger(qty) || qty <= 0) {
        throw new ContractError('Invalid value for "qty". Must be a positive integer.');
      }
      let totalSupply = _calculate_total_supply(vault, balances, stakes);
      if (!Number.isSafeInteger(totalSupply + qty)) {
        throw new ContractError("Quantity too large.");
      }
      let lockLength = {};
      if (input.lockLength) {
        if (!Number.isInteger(input.lockLength) || input.lockLength < settings.get("lockMinLength") || input.lockLength > settings.get("lockMaxLength")) {
          throw new ContractError(`lockLength is out of range. lockLength must be between ${settings.get("lockMinLength")} - ${settings.get("lockMaxLength")}.`);
        }
        lockLength = {lockLength: input.lockLength};
      }
      Object.assign(vote, {
        recipient,
        qty
      }, lockLength);
      votes.push(vote);
    } else if (voteType === "burnVault") {
      const target = input.target;
      if (!target || typeof target !== "string") {
        throw new ContractError("Target is required.");
      }
      if (!_is_valid_arweaveAddress(target)) {
        throw new ContractError("Invalid target.");
      }
      Object.assign(vote, {
        target
      });
      votes.push(vote);
    } else if (voteType === "set") {
      if (typeof input.key !== "string") {
        throw new ContractError("Data type of key not supported.");
      }
      if (input.key === "quorum" || input.key === "support" || input.key === "lockMinLength" ||
         input.key === "lockMaxLength" || 
         input.key === "pageApprovalLength" || input.key === "voteLength") {
        input.value = +input.value;
      }
      if (input.key === "quorum") {
        if (isNaN(input.value) || input.value < 0.01 || input.value > 0.99) {
          throw new ContractError("Quorum must be between 0.01 and 0.99.");
        }
      } else if (input.key === "support") {
        if (isNaN(input.value) || input.value < 0.01 || input.value > 0.99) {
          throw new ContractError("Support must be between 0.01 and 0.99.");
        }
      } else if (input.key === "lockMinLength") {
        if (!Number.isInteger(input.value) || input.value < 1 || input.value >= settings.get("lockMaxLength")) {
          throw new ContractError("lockMinLength cannot be less than 1 and cannot be equal or greater than lockMaxLength.");
        }
      } else if (input.key === "lockMaxLength") {
        if (!Number.isInteger(input.value) || input.value <= settings.get("lockMinLength")) {
          throw new ContractError("lockMaxLength cannot be less than or equal to lockMinLength.");
        }
      } else if (input.key === "pageApprovalLength") {
        if (!Number.isInteger(input.value) || input.value <= 0) {
          throw new ContractError(`pageApprovalLength must be a positive integer.`);
        }
        if (input.value <= settings.get("voteLength")) {
          throw new ContractError(`pageApprovalLength must be greater than voteLength ${settings.get("voteLength")}.`);
        }
      } else if (input.key === "voteLength") {
        if (!Number.isInteger(input.value) || input.value <= 0) {
          throw new ContractError("voteLength must be > 0");
        }
      }
      if (input.key === "role") {
        const recipient = input.recipient;
        if (!recipient) {
          throw new ContractError("No recipient specified");
        }
        if (!_is_valid_arweaveAddress(recipient)) {
          throw new ContractError("Invalid recipient.");
        }
        if (typeof input.value !== 'string') {
          throw new ContractError(`value must be a string.`);
        }
        if (input.value.trim().length > roleValueVoteMaxLength) {
          throw new ContractError(`value for role is longer than max allowed length ${roleValueVoteMaxLength}.`);
        }
        Object.assign(vote, {
          key: input.key,
          value: input.value.trim(),
          recipient
        });
      } else {
        if (typeof input.key !== 'string') {
          throw new ContractError(`key must be a string.`);
        }
        if (!input.key.trim()) {
          throw new ContractError(`You must provide a value for key.`);
        }
        if (input.key.trim().length > keyVoteMaxLength) {
          throw new ContractError(`Key length is longer than max allowed length ${keyVoteMaxLength}`);
        }
        // Assign value
        if (typeof input.value === 'string' && input.value.trim().length > keyStringValueVoteMaxLength) {
          throw new ContractError(`value exceeds max length ${keyStringValueVoteMaxLength}`);
        } else if (typeof input.value === 'string') {
          Object.assign(vote, {
            key: input.key.trim(),
            value: input.value.trim()
          });
        } else if (typeof input.value === 'number') {
          Object.assign(vote, {
            key: input.key.trim(),
            value: +input.value
          });
        } else {
          throw new ContractError('Unknown value type');
        }
      }
      votes.push(vote);
    } else if (voteType === "indicative") {
      votes.push(vote);
    } else {
      throw new ContractError("Invalid vote type.");
    }
    return {state};
  }
  if (input.function === "vote") {
    const id = input.id;
    const cast = input.cast;
    if (!Number.isInteger(id)) {
      throw new ContractError('Invalid value for "id". Must be an integer.');
    }
    const vote = votes[id];
    let voterBalance = 0;
    if (caller in vault) {
      for (let i = 0, j = vault[caller].length; i < j; i++) {
        const locked = vault[caller][i];
        if (locked.start < vote.start && locked.end >= vote.start) {
          voterBalance += locked.balance * (locked.end - locked.start);
        }
      }
    }
    if (voterBalance <= 0) {
      throw new ContractError("Caller does not have locked balances for this vote.");
    }
    if (vote.voted.includes(caller)) {
      throw new ContractError("Caller has already voted.");
    }
    if (+SmartWeave.block.height >= vote.start + settings.get("voteLength")) {
      throw new ContractError("Vote has already concluded.");
    }
    if (cast === "yay") {
      vote.yays += voterBalance;
    } else if (cast === "nay") {
      vote.nays += voterBalance;
    } else {
      throw new ContractError("Vote cast type unrecognised.");
    }
    vote.voted.push(caller);
    return {state};
  }
  if (input.function === "finalize") {
    const id = input.id;
    const vote = votes[id];
    const qty = vote.qty;
    if (!vote) {
      throw new ContractError("This vote doesn't exists.");
    }
    if (+SmartWeave.block.height < vote.start + settings.get("voteLength")) {
      throw new ContractError("Vote has not yet concluded.");
    }
    if (vote.status !== "active") {
      throw new ContractError("Vote is not active.");
    }
    if (vote.totalWeight * settings.get("quorum") > vote.yays + vote.nays) {
      vote.status = "quorumFailed";
      return {state};
    }
    if (vote.yays !== 0 && (vote.nays === 0 || vote.yays / vote.nays > settings.get("support"))) {
      vote.status = "passed";
      if (vote.type === "mint" || vote.type === "mintLocked") {
        let totalSupply = _calculate_total_supply(vault, balances, stakes);
        if (!Number.isSafeInteger(totalSupply + qty)) {
          throw new ContractError("Quantity too large.");
        }
      }
      if (vote.type === "mint") {
        if (vote.recipient in balances) {
          balances[vote.recipient] += qty;
        } else {
          balances[vote.recipient] = qty;
        }
      } else if (vote.type === "mintLocked") {
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
        if (vote.target in vault) {
          delete vault[vote.target];
        } else {
          vote.status = "failed";
        }
      } else if (vote.type === "set") {
        if (vote.key === "role") {
          state.roles[vote.recipient] = vote.value;
        } else {
          settings.set(vote.key, vote.value);
          state.settings = Array.from(settings);
        }
      }
    } else {
      vote.status = "failed";
    }
    return {state};
  }
  if (input.function === "role") {
    const target = input.target || caller;
    const role = target in state.roles ? state.roles[target] : "";
    if (!role.trim().length) {
      throw new Error("Target doesn't have a role specified.");
    }
    return {result: {target, role}};
  }
  if (input.function === "approvePage") {
    const author = input.author;
    const pageTX = input.pageTX;
    const value = +input.pageValue;
    const lang = input.langCode;
    const category = input.category;
    const order = 0;
    const slug = input.slug;
    const role = caller in state.roles ? state.roles[caller] : "";
    const start = +SmartWeave.block.height;
    const pageApprovalLength = +settings.get("pageApprovalLength");
    const end = start + pageApprovalLength;
    const balance = balances[caller];
    let totalSupply = _calculate_total_supply(vault, balances, stakes);
    if (!_is_valid_arweaveAddress(author)) {
      throw new ContractError("Invalid author.");
    }
    if (!Number.isInteger(value) || value <= 0) {
      throw new ContractError('"pageValue" must be a positive integer.');
    }
    if (!Number.isInteger(order) || order < 0) {
      throw new ContractError('"order" must be a positive integer.');
    }
    if (role.trim().toUpperCase() !== "MODERATOR") {
      throw new ContractError("Caller must be an admin");
    }
    if (typeof lang !== 'string' || !lang.trim().length) {
      throw new ContractError("LangCode must be specified");
    }
    if (typeof slug !== 'string' || !slug.trim().length) {
      throw new ContractError("Slug must be specified");
    }
    if (slug.trim().length > pageSlugMaxLength) {
      throw new ContractError(`slug is longer than max allowed length ${pageSlugMaxLength}.`);  
    }  
    if (typeof category !== 'string' || !category.trim().length) {  
      throw new ContractError("Category must be specified");
    }
    if (typeof pageTX !== 'string' || !pageTX.trim().length) {
      throw new ContractError("PageTX must be specified");
    }
    if (!_is_valid_arweaveAddress(pageTX)) {
      throw new ContractError("Invalid pageTX.");
    }
    if (!(caller in vault)) {
      throw new ContractError("Caller needs to have locked balances.");
    }
    let vaultBalance = _get_vaultBalance(vault, caller, end);
    if (vaultBalance < value) {
      throw new ContractError(`Caller doesn't have ${value} or more tokens locked for enough time (start:${start}, end:${end}, vault:${vaultBalance}).`);
    }
    if (!Object.prototype.hasOwnProperty.call(pages, lang)) {
      throw new ContractError("Invalid LangCode (pages)!"); 
    }
    if (!Object.prototype.hasOwnProperty.call(categories, lang)) {
      throw new ContractError("Invalid LangCode (categories)!"); 
    }
    if (Object.prototype.hasOwnProperty.call(pages[lang], slug)) {
      throw new ContractError("Slug already taken!"); 
    }
    if (!Object.prototype.hasOwnProperty.call(categories[lang], category)) {
      throw new ContractError("Invalid Category!"); 
    }
    if (Object.prototype.hasOwnProperty.call(stakes, caller) &&
        Object.prototype.hasOwnProperty.call(stakes[caller], lang) &&
        stakes[caller][lang][slug]) {
      throw new ContractError("User is already staking on this page");
    }
    if (isNaN(balance) || balance < value) {
      throw new ContractError("Not enough balance.");
    }
    if (!Number.isSafeInteger(totalSupply + value)) {
      throw new ContractError("'value' too large.");
    }
    balances[caller] -= value;
    if (!Object.prototype.hasOwnProperty.call(stakes, caller)) {
      stakes[caller] = {};
    }
    if (!Object.prototype.hasOwnProperty.call(stakes[caller], lang)) {
      stakes[caller][lang] = {};
    }
    stakes[caller][lang][slug] = value;
    if (author in vault) {
      vault[author].push({
        balance: value,
        end,
        start,
        slug,
        lang,
        action: "new"
      });
    } else {
      vault[author] = [{
        balance: value,
        end,
        start,
        slug,
        lang,
        action: "new"
      }];
    }
    pages[lang][slug] = {
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

    pages[lang][slug].updates.push({
      tx: pageTX, approvedBy: caller, at: start, value
    });
    return { state };
  }
  if (input.function === "updatePageSponsor") {
    const value = +input.pageValue;
    const role = caller in state.roles ? state.roles[caller] : "";
    const balance = +balances[caller];
    const currentHeight = +SmartWeave.block.height;
    let totalSupply = _calculate_total_supply(vault, balances, stakes);
    const lang = input.langCode;
    const slug = input.slug;
    const pageApprovalLength = +settings.get("pageApprovalLength");
    const end = currentHeight + pageApprovalLength;
    if (typeof lang !== 'string' || !lang.trim().length) {
      throw new ContractError("LangCode must be specified");
    }
    if (typeof slug !== 'string' || !slug.trim().length) {
      throw new ContractError("Slug must be specified");
    }
    if (!Object.prototype.hasOwnProperty.call(pages, lang)) {
      throw new ContractError("Invalid LangCode"); 
    }
    if (!Object.prototype.hasOwnProperty.call(pages[lang], slug)) {
      throw new ContractError("Invalid slug!"); 
    }
    if (!Number.isInteger(value) || value <= 0) {
      throw new ContractError('"pageValue" must be a positive integer.');
    }
    if (isNaN(balance) || balance < value) {
      throw new ContractError(`Not enough balance :: ${balance} vs ${value}`);
    }
    // if (!(caller in vault)) {
    //  throw new ContractError("Caller needs to have locked balances.");
    // }
    // let vaultBalance = _get_vaultBalance(vault, caller, end);
    // if (vaultBalance < value) {
    //  throw new ContractError(`Caller doesn't have ${value} or more tokens locked for enough time  (start:${currentHeight}, end:${end}, vault:${vaultBalance}).`);
    // }
    if (!Number.isSafeInteger(totalSupply + value)) {
      throw new ContractError("'value' too large.");
    }
    const previousSponsor = pages[lang][slug].sponsor;
    const previousValue = pages[lang][slug].value;
    if (Object.prototype.hasOwnProperty.call(stakes, caller) &&
        Object.prototype.hasOwnProperty.call(stakes[caller], lang) &&
        stakes[caller][lang][slug]) {
      throw new ContractError("User is already staking for this page");
    }
    if (previousSponsor === caller) {
      throw new ContractError("Caller is already staking for this page");
    }
    if (value <= previousValue) {
      throw new ContractError("New page value must be greater than the previous one.");
    }
    balances[caller] -= value;
    if (Object.prototype.hasOwnProperty.call(balances, previousSponsor) &&
      stakes[previousSponsor][lang][slug]) {
      balances[previousSponsor] += previousValue;
      delete stakes[previousSponsor][lang][slug];
    }

    if (!Object.prototype.hasOwnProperty.call(stakes, caller)) {
      stakes[caller] = {};
    }
    if (!Object.prototype.hasOwnProperty.call(stakes[caller], lang)) {
      stakes[caller][lang] = {};
    }
    stakes[caller][lang][slug] = value;
    pages[lang][slug].sponsor = caller;
    pages[lang][slug].value = value;
    pages[lang][slug].active = true;
    return { state };
  }
  if (input.function === "stopPageSponsorshipAndDeactivatePage") {
    const currentHeight = +SmartWeave.block.height;
    const lang = input.langCode;
    const slug = input.slug;
    if (typeof lang !== 'string' || !lang.trim().length) {
      throw new ContractError("LangCode must be specified");
    }
    if (typeof slug !== 'string' || !slug.trim().length) {
      throw new ContractError("Slug must be specified");
    }
    if (!Object.prototype.hasOwnProperty.call(pages, lang)) {
      throw new ContractError("Invalid LangCode"); 
    }
    if (!Object.prototype.hasOwnProperty.call(pages[lang], slug)) {
      throw new ContractError("Invalid slug!"); 
    }
    if (!Object.prototype.hasOwnProperty.call(stakes, caller) ||
        !Object.prototype.hasOwnProperty.call(stakes[caller], lang) ||
        !stakes[caller][lang][slug]) {
      throw new ContractError("User is not staking for this page");
    }
    const currentSponsor = pages[lang][slug].sponsor;
    const currentValue = stakes[currentSponsor][lang][slug];
    if (currentSponsor !== caller) {
      throw new ContractError("User is not the sponsor");
    }

    balances[currentSponsor] += currentValue;
    delete stakes[currentSponsor][lang][slug];

    pages[lang][slug].sponsor = '';
    pages[lang][slug].active = false;
    
    return { state };
  }
  if (input.function === "balanceDetail") {
    const target = input.target || caller;
    if (typeof target !== "string") {
      throw new ContractError("Must specificy target to get balance for.");
    }
    let unlockedBalance = 0;
    let vaultBalance = 0;
    let stakingBalance = 0;
    if (target in balances) {
      unlockedBalance = balances[target];
    }
    if (target in vault && vault[target].length) {
      try {
        vaultBalance += vault[target].map((a) => a.balance).reduce((a, b) => a + b, 0);
      } catch (e) {
      }
    }
    const stakingDict = stakes[target] ? stakes[target] : {};
    for (const vLang of Object.keys(stakingDict)) {
      for (const vSlug of Object.keys(stakingDict[vLang])) {
        stakingBalance += stakes[target][vLang][vSlug];
      }
    }

    return {result: {target, unlockedBalance, vaultBalance, stakingBalance}};
  }
  if (input.function === "addPageUpdate") {
    const role = caller in state.roles ? state.roles[caller] : "";
    const currentHeight = +SmartWeave.block.height;
    const lang = input.langCode;
    const slug = input.slug;
    const updateTX = input.updateTX;
    const author = input.author;
    const pageApprovalLength = +settings.get("pageApprovalLength");
    const end = currentHeight + pageApprovalLength;
    const value = +input.pageValue;
    const category = input.category;
    if (!Number.isInteger(value) || value <= 0) {
      throw new ContractError('"pageValue" must be a positive integer.');
    }
    if (typeof author !== 'string' || !author.trim().length) {
      throw new ContractError("Author address must be specified");
    }
    if (typeof lang !== 'string' || !lang.trim().length) {
      throw new ContractError("LangCode must be specified");
    }
    if (typeof slug !== 'string' || !slug.trim().length) {
      throw new ContractError("Slug must be specified");
    }
    if (typeof updateTX !== 'string' || !updateTX.trim().length) {
      throw new ContractError("UpdateTX must be specified");
    }
    if (!Object.prototype.hasOwnProperty.call(pages, lang)) {
      throw new ContractError("Invalid LangCode (pages)"); 
    }
    if (!Object.prototype.hasOwnProperty.call(categories, lang)) {
      throw new ContractError("Invalid LangCode (categories)"); 
    }
    if (!Object.prototype.hasOwnProperty.call(pages[lang], slug)) {
      throw new ContractError("Invalid slug!"); 
    }
    if (typeof category !== 'string' || !category.trim().length) {  
      throw new ContractError("Category must be specified");
    }
    if (!Object.prototype.hasOwnProperty.call(categories[lang], category)) {
      throw new ContractError("Invalid Category!"); 
    }
    if (role.trim().toUpperCase() !== "MODERATOR") {
      throw new ContractError("Caller must be an admin");
    }
    if (!pages[lang][slug].active) {
      throw new ContractError("Page is inactive");
    }
    if (!(caller in vault)) {
      throw new ContractError("Caller needs to have locked balances.");
    }
    let vaultBalance = _get_vaultBalance(vault, caller, end);
    if (vaultBalance < value) {
      throw new ContractError(`Caller doesn't have ${value} or more tokens locked for enough time  (start:${currentHeight}, end:${end}, vault:${vaultBalance}).`);
    }
    pages[lang][slug].updates.push({
      tx: updateTX, approvedBy: caller, at: currentHeight, value
    });
    pages[lang][slug].category = category;
    if (author in vault) {
      vault[author].push({
        balance: value,
        end,
        start: currentHeight,
        slug,
        lang,
        action: "update"
      });
    } else {
      vault[author] = [{
        balance: value,
        end,
        start: currentHeight,
        slug,
        lang,
        action: "update"
      }];
    }
    return { state };
  }
  if (input.function === "activateDeactivatePage") {
    const role = caller in state.roles ? state.roles[caller] : "";
    const currentHeight = +SmartWeave.block.height;
    const lang = input.langCode;
    const slug = input.slug;
    const newStatus = !!input.active;
    if (typeof lang !== 'string' || !lang.trim().length) {
      throw new ContractError("LangCode must be specified");
    }
    if (typeof slug !== 'string' || !slug.trim().length) {
      throw new ContractError("Slug must be specified");
    }
    if (!Object.prototype.hasOwnProperty.call(pages, lang)) {
      throw new ContractError("Invalid LangCode"); 
    }
    if (!Object.prototype.hasOwnProperty.call(pages[lang], slug)) {
      throw new ContractError("Invalid slug!"); 
    }
    if (role.trim().toUpperCase() !== "MODERATOR") {
      throw new ContractError("Caller must be an admin");
    }
    if (!Object.prototype.hasOwnProperty.call(stakes, caller) ||
        !Object.prototype.hasOwnProperty.call(stakes[caller], lang) ||
        !stakes[caller][lang][slug]) {
      throw new ContractError("User is not staking for this page");
    }
    if (pages[lang][slug].sponsor !== caller) {
      throw new ContractError("User is not the sponsor");
    }

    pages[lang][slug].active = newStatus;
    
    return { state };
  }
  if (input.function === "addLanguage" || input.function === "updateLanguage") {
    const langCode = input.langCode.trim().toLowerCase();
    const writingSystem = input.writingSystem.trim().toUpperCase();
    const isoName = input.isoName.trim();
    const nativeName = input.nativeName.trim();
    const role = caller in state.roles ? state.roles[caller] : "";
    const start = +SmartWeave.block.height;
    const pageApprovalLength = +settings.get("pageApprovalLength");
    const end = start + pageApprovalLength;
    const balance = balances[caller];
    const minVaultBalance = +settings.get("moderatorsMinVaultBalance");
    let activeLang = true;
    if (input.function === "updateLanguage") {
      activeLang = !!input.active;
    } 
    if (role.trim().toUpperCase() !== "MODERATOR") {
      throw new ContractError("Caller must be an admin");
    }
    if (typeof langCode !== 'string' || !langCode.length) {
      throw new ContractError("langCode must be specified");
    }
    if (langCode.length > langCodeLength) {
      throw new ContractError(`langCode is longer than max allowed length ${langCodeLength}.`);  
    }
    if (isoName.length > langNameLength) {
      throw new ContractError(`isoName is longer than max allowed length ${langNameLength}.`);  
    }
    if (nativeName.length > langNameLength) {
      throw new ContractError(`nativeName is longer than max allowed length ${langNameLength}.`);  
    }
    if (validWritingSystems.indexOf(writingSystem) < 0) {
      throw new ContractError(`Invalid writing system.`);  
    }
    if (!(caller in vault)) {
      throw new ContractError("Caller needs to have locked balances.");
    }
    let vaultBalance = _get_vaultBalance(vault, caller, end);
    if (vaultBalance < minVaultBalance) {
      throw new ContractError(`Caller doesn't have ${minVaultBalance} or more tokens locked for enough time (start:${start}, end:${end}, vault:${vaultBalance}).`);
    }
    if (input.function === "addLanguage" &&
        Object.prototype.hasOwnProperty.call(languages, langCode)) {
      throw new ContractError("LangCode already exists!"); 
    } else if (input.function === "updateLanguage" &&
        !Object.prototype.hasOwnProperty.call(languages, langCode)) {
      throw new ContractError("LangCode does not exist!"); 
    }
    languages[langCode] = {
      "active": activeLang,
      "iso_name": isoName,
      "native_name": nativeName,
      "writing_system": writingSystem
    };
    if (input.function === "addLanguage") {
      pages[langCode] = {};
      categories[langCode] = {};
    }
    return { state };
  }
  if (input.function === "addCategory" || input.function === "updateCategory") {
    const langCode = input.langCode.trim().toLowerCase();
    const label = input.label.trim();
    const slug = input.slug.trim();
    const parent = input.parent && input.parent.trim() ? input.parent.trim() : null;
    const role = caller in state.roles ? state.roles[caller] : "";
    const order = +input.order;
    const start = +SmartWeave.block.height;
    const pageApprovalLength = +settings.get("pageApprovalLength");
    const end = start + pageApprovalLength;
    const balance = balances[caller];
    const minVaultBalance = +settings.get("moderatorsMinVaultBalance");
    let activeCategory = true;
    if (input.function === "updateCategory") {
      activeCategory = !!input.active;
    } 
    if (role.trim().toUpperCase() !== "MODERATOR") {
      throw new ContractError("Caller must be an admin");
    }
    if (typeof langCode !== 'string' || !langCode.length) {
      throw new ContractError("langCode must be specified");
    }
    if (!Object.prototype.hasOwnProperty.call(categories, langCode)) {
      throw new ContractError("LangCode does not exist! ${langCode}"); 
    } 
    if (label.length > categoryLabelLength) {
      throw new ContractError(`label is longer than max allowed length ${categoryLabelLength}.`);  
    }
    if (slug.length > categorySlugMaxLength) {
      throw new ContractError(`slug is longer than max allowed length ${categorySlugMaxLength}.`);  
    }
    if (parent && !(parent in categories[langCode])) {
      throw new ContractError(`Parent id is not a valid category ${parent}.`)
    }
    if (!Number.isInteger(order) || order < 0) {
      throw new ContractError('"order" must be a positive integer.');
    }
    if (!(caller in vault)) {
      throw new ContractError("Caller needs to have locked balances.");
    }
    let vaultBalance = _get_vaultBalance(vault, caller, end);
    if (vaultBalance < minVaultBalance) {
      throw new ContractError(`Caller doesn't have ${minVaultBalance} or more tokens locked for enough time (start:${start}, end:${end}, vault:${vaultBalance}).`);
    }
    if (input.function === "addCategory" &&
        Object.prototype.hasOwnProperty.call(categories[langCode], slug)) {
      throw new ContractError("Category already exists!"); 
    } else if (input.function === "updateCategory" &&
        !Object.prototype.hasOwnProperty.call(categories[langCode], slug)) {
      throw new ContractError("Category does not exist!"); 
    }
    if (slug == parent) {
      throw new ContractError("Slug and parent_id must be different!");
    }
    categories[langCode][slug] = {
      label: label,
      order: order,
      active: activeCategory,
      parent_id: parent
    };
    return { state };
  }
  if (input.function === "updatePageProperties") {
    const langCode = input.langCode.trim().toLowerCase();
    const slug = input.slug.trim();
    const role = caller in state.roles ? state.roles[caller] : "";
    const order = +input.order;
    const start = +SmartWeave.block.height;
    const pageApprovalLength = +settings.get("pageApprovalLength");
    const end = start + pageApprovalLength;
    const balance = balances[caller];
    const minVaultBalance = +settings.get("moderatorsMinVaultBalance");
    let showInMenu = !!input.showInMenu;
    let showInMainPage = !!input.showInMainPage;
    let showInFooter = !!input.showInFooter;
    const nft = input.nft.trim();

    if (role.trim().toUpperCase() !== "MODERATOR") {
      throw new ContractError("Caller must be an admin");
    }
    if (typeof langCode !== 'string' || !langCode.length) {
      throw new ContractError("langCode must be specified");
    }
    if (!Object.prototype.hasOwnProperty.call(pages, langCode)) {
      throw new ContractError("LangCode does not exist! ${langCode}"); 
    } 
    if (!Number.isInteger(order) || order < 0) {
      throw new ContractError('"order" must be a positive integer.');
    }
    if (!(caller in vault)) {
      throw new ContractError("Caller needs to have locked balances.");
    }
    let vaultBalance = _get_vaultBalance(vault, caller, end);
    if (vaultBalance < minVaultBalance) {
      throw new ContractError(`Caller doesn't have ${minVaultBalance} or more tokens locked for enough time (start:${start}, end:${end}, vault:${vaultBalance}).`);
    }
    if (!Object.prototype.hasOwnProperty.call(pages[langCode], slug)) {
      throw new ContractError("Page does not exist!"); 
    }
    if (nft && !_is_valid_arweaveAddress(nft)) {
      throw new ContractError("Invalid NFT address!"); 
    }

    pages[langCode][slug].order = order;
    pages[langCode][slug].nft = nft;
    pages[langCode][slug].showInMenu = showInMenu;
    pages[langCode][slug].showInMainPage = showInMainPage;
    pages[langCode][slug].showInFooter = showInFooter;

    return { state };
  }
  throw new ContractError(`No function supplied or function not recognised: "${input.function}"`);
}

function _calculate_total_supply(vault, balances, stakes) {
  const vaultValues2 = Object.values(vault);
  let totalSupply = 0;
  for (let i = 0, j = vaultValues2.length; i < j; i++) {
    const locked = vaultValues2[i];
    for (let j2 = 0, k = locked.length; j2 < k; j2++) {
      totalSupply += locked[j2].balance;
    }
  }
  const balancesValues = Object.values(balances);
  for (let i = 0, j = balancesValues.length; i < j; i++) {
    totalSupply += balancesValues[i];
  }
  for (const target of Object.keys(stakes)) {
    for (const vLang of Object.keys(stakes[target])) {
      for (const vSlug of Object.keys(stakes[target][vLang])) {
        totalSupply += stakes[target][vLang][vSlug];
      }
    }
  }
  return totalSupply;
}

function _get_vaultBalance(vault, caller, end) {
  let vaultBalance = 0;
  const filtered = vault[caller].filter((a) => a.end > end && a.start <= end);
  for (let i = 0, j = filtered.length; i < j; i++) {
    vaultBalance += filtered[i].balance;
  }
  return vaultBalance;
}

function _is_valid_arweaveAddress(address) {
  const arweaveAddressLength = 43;
  if (address &&
      typeof address === 'string' &&
      address.trim().length === arweaveAddressLength) {
    return true;
  }
  return false;
}