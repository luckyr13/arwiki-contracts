/******************************************************************************
Copyright (c) Microsoft Corporation.

Permission to use, copy, modify, and/or distribute this software for any
purpose with or without fee is hereby granted.

THE SOFTWARE IS PROVIDED "AS IS" AND THE AUTHOR DISCLAIMS ALL WARRANTIES WITH
REGARD TO THIS SOFTWARE INCLUDING ALL IMPLIED WARRANTIES OF MERCHANTABILITY
AND FITNESS. IN NO EVENT SHALL THE AUTHOR BE LIABLE FOR ANY SPECIAL, DIRECT,
INDIRECT, OR CONSEQUENTIAL DAMAGES OR ANY DAMAGES WHATSOEVER RESULTING FROM
LOSS OF USE, DATA OR PROFITS, WHETHER IN AN ACTION OF CONTRACT, NEGLIGENCE OR
OTHER TORTIOUS ACTION, ARISING OUT OF OR IN CONNECTION WITH THE USE OR
PERFORMANCE OF THIS SOFTWARE.
***************************************************************************** */

function __awaiter(thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
}

/*
*  https://github.com/CommunityXYZ/community-js/blob/master/src/utils.ts#L23
*/
function _isValidArweaveAddress(address) {
    if (address && typeof address === 'string' && address.length === 43) {
        return /[a-z0-9_-]{43}/i.test(address);
    }
    return false;
}

/*
* Based on Smartweave > PST Contract
*	https://github.com/ArweaveTeam/SmartWeave/blob/master/examples/token-pst.js
*/
class PSTContract {
    constructor(state, action) {
        this.state = state;
        this.action = action;
        this.input = this.action.input;
        this.caller = this.action.caller;
    }
    balance(target) {
        const ticker = this.state.ticker;
        let balance = 0;
        const balances = this.state.balances;
        const caller = this.caller;
        // Is target defined?
        if (!target) {
            target = caller;
        }
        // Validate target
        ContractAssert(typeof target === 'string', `Invalid type for target.`);
        ContractAssert(_isValidArweaveAddress(target), `Invalid target address.`);
        // Get balance
        if (target in balances) {
            balance = balances[target];
        }
        return { result: { target, ticker, balance } };
    }
    transfer(target, qty) {
        const balances = this.state.balances;
        const caller = this.caller;
        // Does qty has a valid type?
        ContractAssert(Number.isInteger(qty), `Invalid type for qty.`);
        ContractAssert(Number.isSafeInteger(qty), `qty is too big.`);
        ContractAssert(qty > 0, `qty is less than or equal to zero.`);
        // Is target a valid address?
        ContractAssert(typeof target === 'string', `Invalid type for target.`);
        ContractAssert(!!target, `Target must be defined.`);
        ContractAssert(_isValidArweaveAddress(target), `Invalid target address.`);
        ContractAssert(target !== caller, `The caller cannot be the target.`);
        // Does caller have enough balance?
        ContractAssert(caller in balances, `Caller does not have balance.`);
        ContractAssert(balances[caller] - qty >= 0, `Caller does not have enough balance.`);
        if (!(target in balances)) {
            balances[target] = 0;
        }
        // Is the transfer valid?
        ContractAssert(Number.isSafeInteger(balances[target] + qty), `Final balance for target is too big.`);
        // Do the transfer
        balances[caller] -= qty;
        balances[target] += qty;
        return { state: this.state };
    }
    /*
    *  More information on:
    *  https://academy.warp.cc/docs/sdk/basic/evolve#evolve-1
    */
    evolve(value) {
        const canEvolve = this.state.canEvolve;
        const owner = this.state.owner;
        const caller = this.caller;
        if (canEvolve) {
            ContractAssert(!!value &&
                _isValidArweaveAddress(value), "New contract must have a valid arweave address");
            ContractAssert(owner === caller, `Only the owner can evolve a contract.`);
            this.state.evolve = value;
        }
        return { state: this.state };
    }
}

/*
* Based on CommunityXYZ contract:
* https://github.com/cedriking/communityxzy-contract
* https://community.xyz/
* https://github.com/CommunityXYZ/community-js
* https://github.com/ArweaveTeam/SmartWeave/blob/master/examples/token-pst.js
*/
class PSTCommunityContract extends PSTContract {
    constructor(state, action) {
        super(state, action);
        this.state = state;
    }
    balance(target) {
        const vault = this.state.vault;
        // Unlocked balance
        const { result } = this.unlockedBalance(target);
        let balance = result.balance;
        let ticker = result.ticker;
        target = result.target;
        // Add locked balance (vault)
        if (target in vault) {
            for (const v of vault[target]) {
                balance += v.balance;
            }
        }
        return { result: { target, ticker, balance } };
    }
    unlockedBalance(target) {
        return super.balance(target);
    }
    lock(qty, lockLength) {
        const settings = new Map(this.state.settings);
        const balances = this.state.balances;
        const caller = this.caller;
        const balance = caller in balances ? balances[caller] : 0;
        const lockMinLength = settings.get('lockMinLength') ? settings.get('lockMinLength') : 0;
        const lockMaxLength = settings.get('lockMaxLength') ? settings.get('lockMaxLength') : 0;
        const vault = this.state.vault;
        const start = +SmartWeave.block.height;
        ContractAssert(Number.isInteger(qty) && qty > 0, "Quantity must be a positive integer.");
        ContractAssert(Number.isInteger(lockLength) &&
            lockLength >= lockMinLength &&
            lockLength <= lockMaxLength, `lockLength is out of range. lockLength must be between ${lockMinLength} - ${lockMaxLength}.`);
        ContractAssert(!!balance &&
            !isNaN(balance) &&
            Number.isInteger(balance) &&
            balance - qty >= 0, "Not enough balance.");
        const end = start + lockLength;
        balances[caller] -= qty;
        if (caller in vault) {
            vault[caller].push({
                balance: qty,
                end,
                start
            });
        }
        else {
            vault[caller] = [{
                    balance: qty,
                    end,
                    start
                }];
        }
        return { state: this.state };
    }
    increaseVault(lockLength, id) {
        const settings = new Map(this.state.settings);
        const lockMinLength = settings.get('lockMinLength') ? settings.get('lockMinLength') : 0;
        const lockMaxLength = settings.get('lockMaxLength') ? settings.get('lockMaxLength') : 0;
        const vault = this.state.vault;
        const caller = this.caller;
        const currentHeight = +SmartWeave.block.height;
        ContractAssert(Number.isInteger(lockLength) &&
            lockLength >= lockMinLength &&
            lockLength <= lockMaxLength, `lockLength is out of range. lockLength must be between ${lockMinLength} - ${lockMaxLength}.`);
        ContractAssert(caller in vault, "Caller does not have a vault.");
        ContractAssert(!!vault[caller][id], "Invalid vault ID.");
        ContractAssert(currentHeight < vault[caller][id].end, "This vault has ended.");
        vault[caller][id].end = currentHeight + lockLength;
        return { state: this.state };
    }
    unlock() {
        const caller = this.caller;
        const vault = this.state.vault;
        const balances = this.state.balances;
        const currentHeight = +SmartWeave.block.height;
        if (caller in vault && vault[caller].length) {
            let i = vault[caller].length;
            while (i--) {
                const locked = vault[caller][i];
                if (currentHeight >= locked.end) {
                    if (caller in balances && typeof balances[caller] === "number") {
                        balances[caller] += locked.balance;
                    }
                    else {
                        balances[caller] = locked.balance;
                    }
                    vault[caller].splice(i, 1);
                }
            }
        }
        return { state: this.state };
    }
    vaultBalance(target) {
        let balance = 0;
        const vault = this.state.vault;
        const currentHeight = +SmartWeave.block.height;
        const ticker = this.state.ticker;
        const caller = this.caller;
        // Is target defined?
        if (!target) {
            target = caller;
        }
        if (target in vault) {
            const filtered = vault[target].filter((a) => currentHeight < a.end);
            for (let i = 0, j = filtered.length; i < j; i++) {
                balance += filtered[i].balance;
            }
        }
        return { result: { target, balance, ticker } };
    }
    propose(voteType, note, recipient, qty, lockLength, target, key, value) {
        const noteVoteMaxLength = 200;
        const caller = this.caller;
        const vault = this.state.vault;
        const settings = new Map(this.state.settings);
        const votes = this.state.votes;
        ContractAssert(typeof note === "string", "Note format not recognized.");
        // Trim note
        note = note.trim();
        ContractAssert(note.length <= noteVoteMaxLength, `Note length is longer than the max allowed length ${noteVoteMaxLength}.`);
        ContractAssert(caller in vault, "Caller needs to have locked balances.");
        const hasBalance = vault[caller] && !!vault[caller].filter((a) => a.balance > 0).length;
        ContractAssert(hasBalance, "Caller doesn't have any locked balance.");
        // Validate lock time
        const start = +SmartWeave.block.height;
        const end = start + (+settings.get('voteLength'));
        const vaultBalance = this._get_vaultBalance(vault, caller, end);
        ContractAssert(!!vaultBalance, `Caller doesn't have tokens locked for enough time (start:${start}, end:${end}, vault:${vaultBalance}).`);
        // Total weight
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
            start: start,
            totalWeight
        };
        if (voteType === "mint" || voteType === "mintLocked") {
            vote = this.proposeMint(vote, recipient, qty, lockLength);
            votes.push(vote);
        }
        else if (voteType === "burnVault") {
            vote = this.proposeBurnVault(vote, target);
            votes.push(vote);
        }
        else if (voteType === "set") {
            vote = this.proposeSet(vote, key, value, recipient);
            votes.push(vote);
        }
        else if (voteType === "indicative") {
            votes.push(vote);
        }
        else {
            throw new ContractError("Invalid vote type.");
        }
        return { state: this.state };
    }
    proposeMint(vote, recipient, qty, lockLength) {
        const vault = this.state.vault;
        const balances = this.state.balances;
        const settings = new Map(this.state.settings);
        const lockMinLength = settings.get('lockMinLength') ? settings.get('lockMinLength') : 0;
        const lockMaxLength = settings.get('lockMaxLength') ? settings.get('lockMaxLength') : 0;
        let totalSupply = this._calculate_total_supply(vault, balances);
        if (!recipient) {
            throw new ContractError("No recipient specified");
        }
        if (!qty) {
            throw new ContractError("No qty specified");
        }
        ContractAssert(_isValidArweaveAddress(recipient), "Invalid recipient.");
        ContractAssert(Number.isInteger(qty) && qty > 0, 'Invalid value for "qty". Must be a positive integer.');
        ContractAssert(Number.isSafeInteger(totalSupply + qty) &&
            Number.isSafeInteger(qty), "Quantity too large.");
        let lockLengthObj = {};
        if (lockLength) {
            ContractAssert(Number.isInteger(lockLength) &&
                lockLength >= lockMinLength &&
                lockLength <= lockMaxLength, `lockLength is out of range. lockLength must be between ${lockMinLength} - ${lockMaxLength}.`);
            lockLengthObj = { lockLength: lockLength };
        }
        Object.assign(vote, {
            recipient,
            qty
        }, lockLengthObj);
        return vote;
    }
    proposeBurnVault(vote, target) {
        if (!target || typeof target !== "string") {
            throw new ContractError("Target is required.");
        }
        ContractAssert(_isValidArweaveAddress(target), "Invalid target.");
        Object.assign(vote, {
            target
        });
        return vote;
    }
    proposeSet(vote, key, value, recipient) {
        const settings = new Map(this.state.settings);
        const lockMinLength = settings.get('lockMinLength') ? settings.get('lockMinLength') : 0;
        const lockMaxLength = settings.get('lockMaxLength') ? settings.get('lockMaxLength') : 0;
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
        }
        else if (key === "support") {
            value = +value;
            if (isNaN(value) || value < 0.01 || value > 0.99) {
                throw new ContractError("Support must be between 0.01 and 0.99.");
            }
        }
        else if (key === "lockMinLength") {
            value = +value;
            if (!Number.isInteger(value) || value < 1 || value >= lockMaxLength) {
                throw new ContractError("lockMinLength cannot be less than 1 and cannot be equal or greater than lockMaxLength.");
            }
        }
        else if (key === "lockMaxLength") {
            value = +value;
            if (!Number.isInteger(value) || value <= lockMinLength) {
                throw new ContractError("lockMaxLength cannot be less than or equal to lockMinLength.");
            }
        }
        else if (key === "voteLength") {
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
        }
        else {
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
            }
            else if (typeof value === 'string') {
                Object.assign(vote, {
                    key: key.trim(),
                    value: value.trim()
                });
            }
            else if (typeof value === 'number') {
                Object.assign(vote, {
                    key: key.trim(),
                    value: +value
                });
            }
            else {
                throw new ContractError('Unknown value type');
            }
        }
        return vote;
    }
    vote(id, cast) {
        const votes = this.state.votes;
        const caller = this.caller;
        const vault = this.state.vault;
        const settings = new Map(this.state.settings);
        const voteLength = settings.get('voteLength') ? settings.get('voteLength') : 0;
        ContractAssert(Number.isInteger(id), 'Invalid value for "id". Must be an integer.');
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
        ContractAssert(voterBalance > 0, "Caller does not have locked balances for this vote.");
        ContractAssert(!vote.voted.includes(caller), "Caller has already voted.");
        ContractAssert(+SmartWeave.block.height < vote.start + voteLength, "Vote has already concluded.");
        if (cast === "yay") {
            vote.yays += voterBalance;
        }
        else if (cast === "nay") {
            vote.nays += voterBalance;
        }
        else {
            throw new ContractError("Vote cast type unrecognised.");
        }
        vote.voted.push(caller);
        return { state: this.state };
    }
    finalize(id) {
        const roles = this.state.roles;
        const votes = this.state.votes;
        const vote = votes[id];
        const qty = vote.qty;
        const settings = new Map(this.state.settings);
        const voteLength = settings.get('voteLength') ? settings.get('voteLength') : 0;
        const quorum = settings.get('quorum') ? settings.get('quorum') : 0;
        const support = settings.get('support') ? settings.get('support') : 0;
        const vault = this.state.vault;
        const balances = this.state.balances;
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
            return { state: this.state };
        }
        if (vote.yays !== 0 && (vote.nays === 0 || vote.yays / vote.nays > support)) {
            vote.status = "passed";
            if (vote.type === "mint" || vote.type === "mintLocked") {
                let totalSupply = this._calculate_total_supply(vault, balances);
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
                }
                else {
                    balances[vote.recipient] = qty;
                }
            }
            else if (vote.type === "mintLocked") {
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
                }
                else {
                    vault[vote.recipient] = [locked];
                }
            }
            else if (vote.type === "burnVault") {
                if (!vote.target) {
                    throw new ContractError('vote.target is undefined');
                }
                if (vote.target in vault) {
                    delete vault[vote.target];
                }
                else {
                    vote.status = "failed";
                }
            }
            else if (vote.type === "set") {
                if (vote.key === "role") {
                    if (!vote.recipient) {
                        throw new ContractError('vote.recipient is undefined');
                    }
                    roles[vote.recipient] = vote.value;
                }
                else {
                    if (!vote.key) {
                        throw new ContractError('vote.key is undefined');
                    }
                    settings.set(vote.key, vote.value);
                    this.state.settings = Array.from(settings);
                }
            }
        }
        else {
            vote.status = "failed";
        }
        return { state: this.state };
    }
    role(target) {
        const caller = this.caller;
        const roles = this.state.roles;
        // Is target defined?
        if (!target) {
            target = caller;
        }
        const role = target in roles ? roles[target] : "";
        if (!role.trim().length) {
            throw new ContractError("Target doesn't have a role specified.");
        }
        return { result: { target, role } };
    }
    _get_vaultBalance(vault, caller, end) {
        let vaultBalance = 0;
        const filtered = vault[caller].filter((a) => a.end > end && a.start <= end);
        for (let i = 0, j = filtered.length; i < j; i++) {
            vaultBalance += filtered[i].balance;
        }
        return vaultBalance;
    }
    _calculate_total_supply(vault, balances) {
        // Vault
        const vaultValues2 = Object.values(vault);
        let totalSupply = 0;
        for (let i = 0, j = vaultValues2.length; i < j; i++) {
            const locked = vaultValues2[i];
            for (let j2 = 0, k = locked.length; j2 < k; j2++) {
                totalSupply += locked[j2].balance;
            }
        }
        // Unlocked balances
        const balancesValues = Object.values(balances);
        for (let i = 0, j = balancesValues.length; i < j; i++) {
            totalSupply += balancesValues[i];
        }
        return totalSupply;
    }
}

class ArWikiContract extends PSTCommunityContract {
    constructor(state, action) {
        super(state, action);
        this.state = state;
    }
    balance(target) {
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
        return { result: { target, ticker, balance } };
    }
    approvePage(author, pageTX, pageValue, langCode, slug, category) {
        const caller = this.caller;
        const roles = this.state.roles;
        const settings = new Map(this.state.settings);
        const balances = this.state.balances;
        const vault = this.state.vault;
        const stakes = this.state.stakes;
        const order = 0;
        const role = caller in roles ? roles[caller] : "";
        const start = +SmartWeave.block.height;
        const pageApprovalLength = +settings.get('pageApprovalLength');
        const end = start + pageApprovalLength;
        const balance = balances[caller];
        let totalSupply = this._calculate_total_supply(vault, balances, stakes);
        const value = +pageValue;
        const pageSlugMaxLength = 70;
        const pages = this.state.pages;
        const categories = this.state.categories;
        ContractAssert(_isValidArweaveAddress(author), "Invalid author.");
        ContractAssert(Number.isInteger(value) &&
            value > 0, '"pageValue" must be a positive integer > 0.');
        ContractAssert(Number.isInteger(order) &&
            order >= 0, '"order" must be a positive integer >= 0.');
        ContractAssert(role.trim().toUpperCase() === "MODERATOR", "Caller must be an admin.");
        ContractAssert(typeof langCode === 'string' &&
            !!langCode.trim().length, "LangCode must be specified.");
        ContractAssert(typeof slug === 'string' &&
            !!slug.trim().length, "Slug must be specified.");
        ContractAssert(slug.trim().length <= pageSlugMaxLength, `slug is longer than max allowed length ${pageSlugMaxLength}.`);
        ContractAssert(typeof category === 'string' &&
            !!category.trim().length, `Category must be specified.`);
        ContractAssert(typeof pageTX === 'string' &&
            !!pageTX.trim().length, `PageTX must be specified.`);
        ContractAssert(_isValidArweaveAddress(pageTX), "Invalid pageTX.");
        ContractAssert(caller in vault, "Caller needs to have locked balances.");
        let vaultBalance = this._get_vaultBalance(vault, caller, end);
        ContractAssert(vaultBalance >= value, `Caller doesn't have ${value} or more tokens locked for enough time (start:${start}, end:${end}, vault:${vaultBalance}).`);
        ContractAssert(Object.prototype.hasOwnProperty.call(pages, langCode), "Invalid LangCode (pages)!");
        ContractAssert(Object.prototype.hasOwnProperty.call(categories, langCode), "Invalid LangCode (categories)!");
        ContractAssert(!Object.prototype.hasOwnProperty.call(pages[langCode], slug), "Slug already taken!");
        ContractAssert(Object.prototype.hasOwnProperty.call(categories[langCode], category), "Invalid Category!");
        if (Object.prototype.hasOwnProperty.call(stakes, caller) &&
            Object.prototype.hasOwnProperty.call(stakes[caller], langCode) &&
            stakes[caller][langCode][slug]) {
            throw new ContractError("User is already staking on this page");
        }
        ContractAssert(!isNaN(balance) && balance >= value, "Not enough balance.");
        ContractAssert(Number.isSafeInteger(value) &&
            Number.isSafeInteger(totalSupply + value), "'value' too big.");
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
        }
        else {
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
        return { state: this.state };
    }
    updatePageSponsor(langCode, slug, pageValue) {
        const caller = this.caller;
        const roles = this.state.roles;
        const balances = this.state.balances;
        const vault = this.state.vault;
        const stakes = this.state.stakes;
        const settings = new Map(this.state.settings);
        const pages = this.state.pages;
        const value = +pageValue;
        caller in roles ? roles[caller] : "";
        const balance = +balances[caller];
        +SmartWeave.block.height;
        let totalSupply = this._calculate_total_supply(vault, balances, stakes);
        +settings.get('pageApprovalLength');
        ContractAssert(typeof langCode === 'string' &&
            !!langCode.trim().length, "LangCode must be specified.");
        ContractAssert(typeof slug === 'string' &&
            !!slug.trim().length, "Slug must be specified.");
        ContractAssert(Object.prototype.hasOwnProperty.call(pages, langCode), "Invalid LangCode.");
        ContractAssert(Object.prototype.hasOwnProperty.call(pages[langCode], slug), "Invalid slug.");
        ContractAssert(Number.isInteger(value) && value > 0, '"pageValue" must be a positive integer.');
        ContractAssert(!isNaN(balance) && balance >= value, `Not enough balance :: ${balance} vs ${value}`);
        // if (!(caller in vault)) {
        //  throw new ContractError("Caller needs to have locked balances.");
        // }
        // let vaultBalance = _get_vaultBalance(vault, caller, end);
        // if (vaultBalance < value) {
        //  throw new ContractError(`Caller doesn't have ${value} or more tokens locked for enough time  (start:${currentHeight}, end:${end}, vault:${vaultBalance}).`);
        // }
        ContractAssert(Number.isSafeInteger(value) &&
            Number.isSafeInteger(totalSupply + value), "'value' too large.");
        const previousSponsor = pages[langCode][slug].sponsor;
        const previousValue = pages[langCode][slug].value;
        if (Object.prototype.hasOwnProperty.call(stakes, caller) &&
            Object.prototype.hasOwnProperty.call(stakes[caller], langCode) &&
            stakes[caller][langCode][slug]) {
            throw new ContractError("User is already staking for this page");
        }
        ContractAssert(previousSponsor !== caller, "Caller is already staking for this page");
        ContractAssert(value > previousValue, "New page value must be greater than the previous one.");
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
        return { state: this.state };
    }
    stopPageSponsorshipAndDeactivatePage(langCode, slug) {
        +SmartWeave.block.height;
        const pages = this.state.pages;
        const stakes = this.state.stakes;
        const caller = this.caller;
        const balances = this.state.balances;
        ContractAssert(typeof langCode === 'string' &&
            !!langCode.trim().length, "LangCode must be specified.");
        ContractAssert(typeof slug === 'string' &&
            !!slug.trim().length, "Slug must be specified.");
        ContractAssert(Object.prototype.hasOwnProperty.call(pages, langCode), "Invalid LangCode.");
        ContractAssert(Object.prototype.hasOwnProperty.call(pages[langCode], slug), "Invalid slug.");
        if (!Object.prototype.hasOwnProperty.call(stakes, caller) ||
            !Object.prototype.hasOwnProperty.call(stakes[caller], langCode) ||
            !stakes[caller][langCode][slug]) {
            throw new ContractError("User is not staking for this page");
        }
        const currentSponsor = pages[langCode][slug].sponsor;
        const currentValue = stakes[currentSponsor][langCode][slug];
        ContractAssert(currentSponsor === caller, "User is not the sponsor");
        // Write changes
        balances[currentSponsor] += currentValue;
        delete stakes[currentSponsor][langCode][slug];
        pages[langCode][slug].sponsor = '';
        pages[langCode][slug].active = false;
        return { state: this.state };
    }
    balanceDetail(target) {
        this.caller;
        const balances = this.state.balances;
        const vault = this.state.vault;
        const stakes = this.state.stakes;
        const ticker = this.state.ticker;
        let unlockedBalance = 0;
        let vaultBalance = 0;
        let stakingBalance = 0;
        if (!target) {
            target = this.caller;
        }
        ContractAssert(typeof target === "string", "Must specificy target to get balance for.");
        // Unlocked balance
        if (target in balances) {
            unlockedBalance = balances[target];
        }
        // Vault balance
        if (target in vault && vault[target].length) {
            try {
                vaultBalance += vault[target].map((a) => a.balance).reduce((a, b) => a + b, 0);
            }
            catch (e) {
            }
        }
        // Staked balance
        const stakingDict = stakes[target] ? stakes[target] : {};
        for (const vLang of Object.keys(stakingDict)) {
            for (const vSlug of Object.keys(stakingDict[vLang])) {
                stakingBalance += stakes[target][vLang][vSlug];
            }
        }
        return { result: { target, unlockedBalance, vaultBalance, stakingBalance, ticker } };
    }
    addPageUpdate(langCode, slug, updateTX, author, pageValue, category) {
        const roles = this.state.roles;
        const caller = this.caller;
        const settings = new Map(this.state.settings);
        const vault = this.state.vault;
        const role = caller in roles ? roles[caller] : "";
        const currentHeight = +SmartWeave.block.height;
        const pageApprovalLength = +settings.get('pageApprovalLength');
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
        ContractAssert(typeof langCode === 'string' &&
            !!langCode.trim().length, "LangCode must be specified.");
        ContractAssert(typeof slug === 'string' &&
            !!slug.trim().length, "Slug must be specified.");
        ContractAssert(typeof updateTX === 'string' &&
            !!updateTX.trim().length, "updateTX must be specified.");
        ContractAssert(typeof category === 'string' &&
            !!category.trim().length, "category must be specified.");
        ContractAssert(Object.prototype.hasOwnProperty.call(pages, langCode), "Invalid LangCode (pages).");
        ContractAssert(Object.prototype.hasOwnProperty.call(categories, langCode), "Invalid LangCode (categories).");
        ContractAssert(Object.prototype.hasOwnProperty.call(pages[langCode], slug), "Invalid slug.");
        ContractAssert(Object.prototype.hasOwnProperty.call(categories[langCode], category), "Invalid Category.");
        ContractAssert(role.trim().toUpperCase() === "MODERATOR", "Caller must be an admin.");
        ContractAssert(pages[langCode][slug].active, "Page is inactive.");
        ContractAssert(caller in vault, "Caller needs to have locked balances.");
        let vaultBalance = this._get_vaultBalance(vault, caller, end);
        ContractAssert(vaultBalance >= value, `Caller doesn't have ${value} or more tokens locked for enough time  (start:${currentHeight}, end:${end}, vault:${vaultBalance}).`);
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
        }
        else {
            vault[author] = [{
                    balance: value,
                    end,
                    start: currentHeight,
                    slug,
                    lang: langCode,
                    action: "update"
                }];
        }
        return { state: this.state };
    }
    addUpdateLanguage(method, langCode, writingSystem, isoName, nativeName, activeLang) {
        const caller = this.caller;
        const roles = this.state.roles;
        const settings = new Map(this.state.settings);
        const balances = this.state.balances;
        const vault = this.state.vault;
        const languages = this.state.languages;
        const pages = this.state.pages;
        const categories = this.state.categories;
        const langCodeLength = 2;
        const langNameLength = 50;
        langCode = langCode.trim().toLowerCase();
        writingSystem = writingSystem.trim().toUpperCase();
        isoName = isoName.trim();
        nativeName = nativeName.trim();
        const role = caller in roles ? roles[caller] : "";
        const start = +SmartWeave.block.height;
        const pageApprovalLength = +settings.get('pageApprovalLength');
        const end = start + pageApprovalLength;
        balances[caller];
        const minVaultBalance = +settings.get('moderatorsMinVaultBalance');
        const validWritingSystems = ['LTR', 'RTL'];
        if (method === "updateLanguage") {
            activeLang = !!activeLang;
        }
        else {
            activeLang = true;
        }
        ContractAssert(role.trim().toUpperCase() === "MODERATOR", "Caller must be an admin");
        ContractAssert(typeof langCode === 'string' &&
            !!langCode.length, "langCode must be specified");
        ContractAssert(langCode.length <= langCodeLength, `langCode is longer than max allowed length ${langCodeLength}.`);
        ContractAssert(isoName.length <= langNameLength, `isoName is longer than max allowed length ${langNameLength}.`);
        ContractAssert(nativeName.length <= langNameLength, `nativeName is longer than max allowed length ${langNameLength}.`);
        ContractAssert(validWritingSystems.indexOf(writingSystem) >= 0, `Invalid writing system.`);
        ContractAssert(caller in vault, "Caller needs to have locked balances.");
        let vaultBalance = this._get_vaultBalance(vault, caller, end);
        if (vaultBalance < minVaultBalance) {
            throw new ContractError(`Caller doesn't have ${minVaultBalance} or more tokens locked for enough time (start:${start}, end:${end}, vault:${vaultBalance}).`);
        }
        if (method === "addLanguage" &&
            Object.prototype.hasOwnProperty.call(languages, langCode)) {
            throw new ContractError("LangCode already exists!");
        }
        else if (method === "updateLanguage" &&
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
        return { state: this.state };
    }
    addUpdateCategory(method, langCode, label, slug, parent, order, activeCategory) {
        const caller = this.caller;
        const roles = this.state.roles;
        const settings = new Map(this.state.settings);
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
        const pageApprovalLength = +settings.get('pageApprovalLength');
        const end = start + pageApprovalLength;
        balances[caller];
        const minVaultBalance = +settings.get('moderatorsMinVaultBalance');
        if (method === "updateCategory") {
            activeCategory = !!activeCategory;
        }
        else {
            activeCategory = true;
        }
        ContractAssert(role.trim().toUpperCase() === "MODERATOR", "Caller must be an admin");
        ContractAssert(typeof langCode === 'string' &&
            !!langCode.length, "langCode must be specified");
        ContractAssert(Object.prototype.hasOwnProperty.call(categories, langCode), "LangCode does not exist! ${langCode}");
        ContractAssert(label.length <= categoryLabelLength, `label is longer than max allowed length ${categoryLabelLength}.`);
        ContractAssert(slug.length <= categorySlugMaxLength, `slug is longer than max allowed length ${categorySlugMaxLength}.`);
        if (parent && !(parent in categories[langCode])) {
            throw new ContractError(`Parent id is not a valid category ${parent}.`);
        }
        ContractAssert(Number.isInteger(order) && order >= 0, '"order" must be a positive integer.');
        ContractAssert(caller in vault, "Caller needs to have locked balances.");
        let vaultBalance = this._get_vaultBalance(vault, caller, end);
        if (vaultBalance < minVaultBalance) {
            throw new ContractError(`Caller doesn't have ${minVaultBalance} or more tokens locked for enough time (start:${start}, end:${end}, vault:${vaultBalance}).`);
        }
        if (method === "addCategory" &&
            Object.prototype.hasOwnProperty.call(categories[langCode], slug)) {
            throw new ContractError("Category already exists!");
        }
        else if (method === "updateCategory" &&
            !Object.prototype.hasOwnProperty.call(categories[langCode], slug)) {
            throw new ContractError("Category does not exist!");
        }
        ContractAssert(slug !== parent, "Slug and parent_id must be different!");
        // Write changes
        categories[langCode][slug] = {
            label: label,
            order: order,
            active: activeCategory,
            parent_id: parent
        };
        return { state: this.state };
    }
    updatePageProperties(langCode, slug, order, showInMenu, showInMainPage, showInFooter, nft) {
        const caller = this.caller;
        const roles = this.state.roles;
        const settings = new Map(this.state.settings);
        const balances = this.state.balances;
        const pages = this.state.pages;
        const vault = this.state.vault;
        langCode = langCode.trim().toLowerCase();
        slug = slug.trim();
        const role = caller in roles ? roles[caller] : "";
        order = +order;
        const start = +SmartWeave.block.height;
        const pageApprovalLength = +settings.get('pageApprovalLength');
        const end = start + pageApprovalLength;
        balances[caller];
        const minVaultBalance = +settings.get('moderatorsMinVaultBalance');
        showInMenu = !!showInMenu;
        showInMainPage = !!showInMainPage;
        showInFooter = !!showInFooter;
        nft = nft.trim();
        ContractAssert(role.trim().toUpperCase() === "MODERATOR", "Caller must be an admin");
        ContractAssert(typeof langCode === 'string' &&
            !!langCode.length, "langCode must be specified");
        ContractAssert(Object.prototype.hasOwnProperty.call(pages, langCode), "LangCode does not exist! ${langCode}");
        ContractAssert(Number.isInteger(order) && order >= 0, '"order" must be a positive integer.');
        ContractAssert(caller in vault, "Caller needs to have locked balances.");
        let vaultBalance = this._get_vaultBalance(vault, caller, end);
        ContractAssert(vaultBalance >= minVaultBalance, `Caller doesn't have ${minVaultBalance} or more tokens locked for enough time (start:${start}, end:${end}, vault:${vaultBalance}).`);
        ContractAssert(Object.prototype.hasOwnProperty.call(pages[langCode], slug), "Page does not exist!");
        if (nft && !_isValidArweaveAddress(nft)) {
            throw new ContractError("Invalid NFT address!");
        }
        // Write changes
        pages[langCode][slug].order = order;
        pages[langCode][slug].nft = nft;
        pages[langCode][slug].showInMenu = showInMenu;
        pages[langCode][slug].showInMainPage = showInMainPage;
        pages[langCode][slug].showInFooter = showInFooter;
        return { state: this.state };
    }
    // Override parent method
    // Add stakes in _calculate_total_supply
    proposeMint(vote, recipient, qty, lockLength) {
        const vault = this.state.vault;
        const balances = this.state.balances;
        const settings = new Map(this.state.settings);
        const lockMinLength = settings.get('lockMinLength') ? settings.get('lockMinLength') : 0;
        const lockMaxLength = settings.get('lockMaxLength') ? settings.get('lockMaxLength') : 0;
        const stakes = this.state.stakes;
        let totalSupply = this._calculate_total_supply(vault, balances, stakes);
        if (!recipient) {
            throw new ContractError("No recipient specified");
        }
        if (!qty) {
            throw new ContractError("No qty specified");
        }
        ContractAssert(_isValidArweaveAddress(recipient), "Invalid recipient.");
        ContractAssert(Number.isInteger(qty) && qty > 0, 'Invalid value for "qty". Must be a positive integer.');
        ContractAssert(Number.isSafeInteger(totalSupply + qty) &&
            Number.isSafeInteger(qty), "Quantity too large.");
        let lockLengthObj = {};
        if (lockLength) {
            ContractAssert(Number.isInteger(lockLength) &&
                lockLength >= lockMinLength &&
                lockLength <= lockMaxLength, `lockLength is out of range. lockLength must be between ${lockMinLength} - ${lockMaxLength}.`);
            lockLengthObj = { lockLength: lockLength };
        }
        Object.assign(vote, {
            recipient,
            qty
        }, lockLengthObj);
        return vote;
    }
    // Override parent method
    // Add pageApprovalLength
    proposeSet(vote, key, value, recipient) {
        const settings = new Map(this.state.settings);
        const roleValueVoteMaxLength = 50;
        const keyVoteMaxLength = 50;
        const keyStringValueVoteMaxLength = 50;
        const lockMinLength = settings.get('lockMinLength') ? settings.get('lockMinLength') : 0;
        const lockMaxLength = settings.get('lockMaxLength') ? settings.get('lockMaxLength') : 0;
        const voteLength = settings.get('voteLength') ? settings.get('voteLength') : 0;
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
        }
        else if (key === "support") {
            value = +value;
            if (isNaN(value) || value < 0.01 || value > 0.99) {
                throw new ContractError("Support must be between 0.01 and 0.99.");
            }
        }
        else if (key === "lockMinLength") {
            value = +value;
            if (!Number.isInteger(value) || value < 1 || value >= lockMaxLength) {
                throw new ContractError("lockMinLength cannot be less than 1 and cannot be equal or greater than lockMaxLength.");
            }
        }
        else if (key === "lockMaxLength") {
            value = +value;
            if (!Number.isInteger(value) || value <= lockMinLength) {
                throw new ContractError("lockMaxLength cannot be less than or equal to lockMinLength.");
            }
        }
        else if (key === "pageApprovalLength") {
            value = +value;
            if (!Number.isInteger(value) || value <= 0) {
                throw new ContractError(`pageApprovalLength must be a positive integer.`);
            }
            if (value <= voteLength) {
                throw new ContractError(`pageApprovalLength must be greater than voteLength ${voteLength}.`);
            }
        }
        else if (key === "voteLength") {
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
        }
        else {
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
            }
            else if (typeof value === 'string') {
                Object.assign(vote, {
                    key: key.trim(),
                    value: value.trim()
                });
            }
            else if (typeof value === 'number') {
                Object.assign(vote, {
                    key: key.trim(),
                    value: +value
                });
            }
            else {
                throw new ContractError('Unknown value type');
            }
        }
        return vote;
    }
    // Override parent method
    finalize(id) {
        const roles = this.state.roles;
        const votes = this.state.votes;
        const vote = votes[id];
        const qty = vote.qty;
        const settings = new Map(this.state.settings);
        const voteLength = settings.get('voteLength') ? settings.get('voteLength') : 0;
        const quorum = settings.get('quorum') ? settings.get('quorum') : 0;
        const support = settings.get('support') ? settings.get('support') : 0;
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
            return { state: this.state };
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
                }
                else {
                    balances[vote.recipient] = qty;
                }
            }
            else if (vote.type === "mintLocked") {
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
                }
                else {
                    vault[vote.recipient] = [locked];
                }
            }
            else if (vote.type === "burnVault") {
                if (!vote.target) {
                    throw new ContractError('vote.target is undefined');
                }
                if (vote.target in vault) {
                    delete vault[vote.target];
                }
                else {
                    vote.status = "failed";
                }
            }
            else if (vote.type === "set") {
                if (vote.key === "role") {
                    if (!vote.recipient) {
                        throw new ContractError('vote.recipient is undefined');
                    }
                    roles[vote.recipient] = vote.value;
                }
                else {
                    if (!vote.key) {
                        throw new ContractError('vote.key is undefined');
                    }
                    settings.set(vote.key, vote.value);
                    this.state.settings = Array.from(settings);
                }
            }
        }
        else {
            vote.status = "failed";
        }
        return { state: this.state };
    }
    // Override parent method
    _calculate_total_supply(vault, balances, stakes) {
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
    _get_vaultBalance(vault, caller, end) {
        let vaultBalance = 0;
        const filtered = vault[caller].filter((a) => a.end > end && a.start <= end);
        for (let i = 0, j = filtered.length; i < j; i++) {
            vaultBalance += filtered[i].balance;
        }
        return vaultBalance;
    }
}

function handle(state, action) {
    return __awaiter(this, void 0, void 0, function* () {
        const arwiki = new ArWikiContract(state, action);
        const input = action.input;
        const method = action.input.function;
        if (method === 'balance') {
            const target = input.target;
            return arwiki.balance(target);
        }
        else if (method === 'transfer') {
            const target = input.target;
            const qty = input.qty;
            return arwiki.transfer(target, qty);
        }
        else if (method === 'unlockedBalance') {
            const target = input.target;
            return arwiki.unlockedBalance(target);
        }
        else if (method === 'lock') {
            const qty = input.qty;
            const lockLength = input.lockLength;
            return arwiki.lock(qty, lockLength);
        }
        else if (method === 'increaseVault') {
            const id = input.id;
            const lockLength = input.lockLength;
            return arwiki.increaseVault(id, lockLength);
        }
        else if (method === 'unlock') {
            return arwiki.unlock();
        }
        else if (method === 'vaultBalance') {
            const target = input.target;
            return arwiki.vaultBalance(target);
        }
        else if (method === 'propose') {
            const voteType = input.type;
            const note = input.note;
            const recipient = input.recipient;
            const qty = input.qty;
            const lockLength = input.lockLength;
            const target = input.target;
            const key = input.key;
            const value = input.value;
            return arwiki.propose(voteType, note, recipient, qty, lockLength, target, key, value);
        }
        else if (method === 'vote') {
            const id = input.id;
            const cast = input.cast;
            return arwiki.vote(id, cast);
        }
        else if (method === 'finalize') {
            const id = input.id;
            return arwiki.finalize(id);
        }
        else if (method === 'role') {
            const target = input.target;
            return arwiki.role(target);
        }
        else if (method === 'approvePage') {
            const author = input.author;
            const pageTX = input.pageTX;
            const pageValue = input.pageValue;
            const langCode = input.langCode;
            const category = input.category;
            const slug = input.slug;
            return arwiki.approvePage(author, pageTX, pageValue, langCode, slug, category);
        }
        else if (method === 'updatePageSponsor') {
            const pageValue = input.pageValue;
            const langCode = input.langCode;
            const slug = input.slug;
            return arwiki.updatePageSponsor(langCode, slug, pageValue);
        }
        else if (method === 'stopPageSponsorshipAndDeactivatePage') {
            const langCode = input.langCode;
            const slug = input.slug;
            return arwiki.stopPageSponsorshipAndDeactivatePage(langCode, slug);
        }
        else if (method === 'balanceDetail') {
            const target = input.target;
            return arwiki.balanceDetail(target);
        }
        else if (method === 'addPageUpdate') {
            const author = input.author;
            const updateTX = input.updateTX;
            const pageValue = input.pageValue;
            const langCode = input.langCode;
            const category = input.category;
            const slug = input.slug;
            return arwiki.addPageUpdate(langCode, slug, updateTX, author, pageValue, category);
        }
        else if (method === 'addLanguage' || method === 'updateLanguage') {
            const langCode = input.langCode;
            const writingSystem = input.writingSystem;
            const isoName = input.isoName;
            const nativeName = input.nativeName;
            const activeLang = input.active;
            return arwiki.addUpdateLanguage(method, langCode, writingSystem, isoName, nativeName, activeLang);
        }
        else if (method === 'addCategory' || method === 'updateCategory') {
            const langCode = input.langCode;
            const label = input.label;
            const slug = input.slug;
            const parent = input.parent;
            const order = input.order;
            const activeCategory = input.active;
            return arwiki.addUpdateCategory(method, langCode, label, slug, parent, order, activeCategory);
        }
        else if (method === 'updatePageProperties') {
            const langCode = input.langCode;
            const slug = input.slug;
            const order = input.order;
            const showInMenu = input.showInMenu;
            const showInMainPage = input.showInMainPage;
            const showInFooter = input.showInFooter;
            const nft = input.nft;
            return arwiki.updatePageProperties(langCode, slug, order, showInMenu, showInMainPage, showInFooter, nft);
        }
        else if (method === 'evolve') {
            const value = input.value;
            return arwiki.evolve(value);
        }
        throw new ContractError(`No function supplied or function not recognised: "${input.function}"`);
    });
}

export { handle };
