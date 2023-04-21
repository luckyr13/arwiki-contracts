import { AtomicNFT } from './AtomicNFT';
import { ArWikiAtomicNFTState, ArWikiLinkedProperties } from './ArWikiAtomicNFTState';

export interface ArWikiAtomicNFT extends AtomicNFT {
	state: ArWikiAtomicNFTState;
	linkedInfo(): {result:{linkedContract:string, linkedProperties:ArWikiLinkedProperties}};
	updateLinkedContract(contract: string): Promise<{ state: ArWikiAtomicNFTState }>;
}