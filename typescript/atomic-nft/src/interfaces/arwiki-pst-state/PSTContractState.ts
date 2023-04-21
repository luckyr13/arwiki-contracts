export interface PSTContractState {
  balances: Record<string, number>;
  owner: string;
  ticker: string;
  canEvolve: boolean;
  evolve: null|string;
}