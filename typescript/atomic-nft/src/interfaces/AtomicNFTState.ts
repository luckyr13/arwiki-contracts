/*
* https://github.com/atomic-nfts/standard#the-state-object
*/

export interface AtomicNFTState {
	balances: Record<string, number>;
	title: string;
	name: string;
	description: string;
	ticker: string;
	contentType: string;
	createdAt: number;
}