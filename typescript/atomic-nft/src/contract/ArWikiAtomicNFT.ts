import { AtomicNFT } from './AtomicNFT';
import { ArWikiAtomicNFTState, ArWikiLinkedProperties } from '../interfaces/ArWikiAtomicNFTState';
import { _isValidArweaveAddress } from './ContractUtils';
import { ArWikiAtomicNFT as ArWikiAtomicNFTBase } from '../interfaces/ArWikiAtomicNFT';
import { ArWikiContractState } from '../interfaces/arwiki-pst-state/ArWikiContractState';

export class ArWikiAtomicNFT 
  extends AtomicNFT 
  implements ArWikiAtomicNFTBase
{
  state: ArWikiAtomicNFTState;

  constructor(state: ArWikiAtomicNFTState, action: ContractInteraction) {
    super(state, action);
    this.state = state;
  }

  // Override transfer
  public async transfer(target: string, qty: number): Promise<{ state:ArWikiAtomicNFTState }> {
    const balances = this.state.balances;
    const linkedContract = this.state.linkedContract;
    const linkedState: ArWikiContractState = await SmartWeave.contracts.readContractState(linkedContract);
    const linkedProperties = this.state.linkedProperties;
    const langCode = linkedProperties.langCode.toLowerCase();
    const slug = linkedProperties.slug;

    // Is target a valid address?
    ContractAssert(
      typeof target === 'string',
      `Invalid type for target.`
    );
    ContractAssert(
      !!target,
      `Target must be defined.`
    );
    ContractAssert(
      _isValidArweaveAddress(target),
      `Invalid target address.`
    );
    ContractAssert(
      !(target in balances) ||
      balances[target] === 0,
      `Target is the current owner.`
    );

    // Verify that target is the Page Owner
    // on the linked contract
    ContractAssert(
      !!target &&
      typeof target === 'string' &&
      _isValidArweaveAddress(target),
      'Invalid target.'
    );
    ContractAssert(
      !!linkedState.pages,
      'Pages is undefined in linkedContract.'
    );
    ContractAssert(
      Object.prototype.hasOwnProperty.call(
        linkedState.pages,
        langCode
      ),
      'LangCode does not exist on pages.'
    );
    ContractAssert(
      Object.prototype.hasOwnProperty.call(
        linkedState.pages[langCode],
        slug
      ),
      'Slug does not exist on pages.'
    );
    ContractAssert(
      linkedState.pages[langCode][slug].sponsor === target,
      'Target is not the page sponsor.'
    );

    // Does qty has a valid type?
    ContractAssert(
      Number.isInteger(qty),
      `Invalid type for qty.`
    );
    ContractAssert(
      Number.isSafeInteger(qty),
      `qty is too big.`
    );
    ContractAssert(
      qty === 1,
      `qty must be 1.`
    );

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
  }

  public linkedInfo(): {result:{linkedContract:string, linkedProperties:ArWikiLinkedProperties}} {
    const linkedContract = this.state.linkedContract;
    const linkedProperties = this.state.linkedProperties;
    return { result:{linkedContract, linkedProperties} };
  }

  public async updateLinkedContract(contract: string): Promise<{ state: ArWikiAtomicNFTState }> {
    const caller = this.caller;
    const linkedContract = this.state.linkedContract;
    const linkedState: ArWikiContractState = await SmartWeave.contracts.readContractState(linkedContract);

    // Verify if caller is a Moderator
    ContractAssert(
      !!linkedState.roles,
      'Roles is undefined in original linkedContract.'
    );
    ContractAssert(
      Object.prototype.hasOwnProperty.call(
        linkedState.roles,
        caller
      ) &&
      typeof linkedState.roles[caller] === 'string' &&
      linkedState.roles[caller].toUpperCase() === 'MODERATOR',
      'Caller must be a Moderator.'
    );
    
    // Verify if new contract is valid
    ContractAssert(
      !!contract && typeof contract === 'string',
      'Invalid new linkedContract address type'
    );
    ContractAssert(
      _isValidArweaveAddress(contract),
      'Invalid new linkedContract address'
    );

    // Write changes
    this.state.linkedContract = contract;

    return { state:this.state }; 
  }

}