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
    if (address && typeof address === 'string') {
        return /[a-z0-9_-]{43}/i.test(address);
    }
    return false;
}

class AtomicNFT {
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
        return __awaiter(this, void 0, void 0, function* () {
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
        });
    }
}

class ArWikiAtomicNFT extends AtomicNFT {
    constructor(state, action) {
        super(state, action);
        this.state = state;
    }
    // Override transfer
    transfer(target, qty) {
        return __awaiter(this, void 0, void 0, function* () {
            const balances = this.state.balances;
            const linkedContract = this.state.linkedContract;
            const linkedState = yield SmartWeave.contracts.readContractState(linkedContract);
            const linkedProperties = this.state.linkedProperties;
            const langCode = linkedProperties.langCode.toLowerCase();
            const slug = linkedProperties.slug;
            // Is target a valid address?
            ContractAssert(typeof target === 'string', `Invalid type for target.`);
            ContractAssert(!!target, `Target must be defined.`);
            ContractAssert(_isValidArweaveAddress(target), `Invalid target address.`);
            ContractAssert(!(target in balances) ||
                balances[target] === 0, `Target is the current owner.`);
            // Verify that target is the Page Owner
            // on the linked contract
            ContractAssert(!!target &&
                typeof target === 'string' &&
                _isValidArweaveAddress(target), 'Invalid target.');
            ContractAssert(!!linkedState.pages, 'Pages is undefined in linkedContract.');
            ContractAssert(Object.prototype.hasOwnProperty.call(linkedState.pages, langCode), 'LangCode does not exist on pages.');
            ContractAssert(Object.prototype.hasOwnProperty.call(linkedState.pages[langCode], slug), 'Slug does not exist on pages.');
            ContractAssert(linkedState.pages[langCode][slug].sponsor === target, 'Target is not the page sponsor.');
            // Does qty has a valid type?
            ContractAssert(Number.isInteger(qty), `Invalid type for qty.`);
            ContractAssert(Number.isSafeInteger(qty), `qty is too big.`);
            ContractAssert(qty === 1, `qty must be 1.`);
            // Reset balances for previous owners
            for (const previousOwner in balances) {
                balances[previousOwner] = 0;
            }
            // Is target a new owner?
            if (!(target in balances)) {
                balances[target] = 0;
            }
            // Do the transfer
            balances[target] += qty;
            return { state: this.state };
        });
    }
    linkedInfo() {
        const linkedContract = this.state.linkedContract;
        const linkedProperties = this.state.linkedProperties;
        return { result: { linkedContract, linkedProperties } };
    }
    updateLinkedContract(contract) {
        return __awaiter(this, void 0, void 0, function* () {
            const caller = this.caller;
            const linkedContract = this.state.linkedContract;
            const linkedState = yield SmartWeave.contracts.readContractState(linkedContract);
            // Verify if caller is a Moderator
            ContractAssert(!!linkedState.roles, 'Roles is undefined in original linkedContract.');
            ContractAssert(Object.prototype.hasOwnProperty.call(linkedState.roles, caller) &&
                typeof linkedState.roles[caller] === 'string' &&
                linkedState.roles[caller].toUpperCase() === 'MODERATOR', 'Caller must be a Moderator.');
            // Verify if new contract is valid
            ContractAssert(!!contract && typeof contract === 'string', 'Invalid new linkedContract address type');
            ContractAssert(_isValidArweaveAddress(contract), 'Invalid new linkedContract address');
            // Write changes
            this.state.linkedContract = contract;
            return { state: this.state };
        });
    }
}

function handle(state, action) {
    return __awaiter(this, void 0, void 0, function* () {
        const atomicNFT = new ArWikiAtomicNFT(state, action);
        const input = action.input;
        const method = action.input.function;
        if (method === 'balance') {
            const target = input.target;
            return atomicNFT.balance(target);
        }
        else if (method === 'transfer') {
            const target = input.target;
            const qty = input.qty;
            return yield atomicNFT.transfer(target, qty);
        }
        else if (method === 'linkedInfo') {
            return atomicNFT.linkedInfo();
        }
        else if (method === 'updateLinkedContract') {
            const contract = input.contractAddress;
            return yield atomicNFT.updateLinkedContract(contract);
        }
        throw new ContractError(`Invalid function!`);
    });
}
