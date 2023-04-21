/*
* 
*/
import { AtomicNFTState } from './AtomicNFTState';

export interface ArWikiAtomicNFTState extends AtomicNFTState {
    linkedContract: string;
    linkedProperties: ArWikiLinkedProperties;
}

export interface ArWikiLinkedProperties {
    slug: string;
    langCode: string;
}