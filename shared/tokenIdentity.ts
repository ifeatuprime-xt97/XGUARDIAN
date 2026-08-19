export type TokenRegistryEvidence = {
  status: "listed" | "not-listed" | "unavailable";
  source?: "OKX X Layer Token List";
  logoUri?: string;
  name?: string;
  symbol?: string;
  decimals?: number;
};

export type ContractVerificationEvidence = {
  status: "verified" | "not-verified" | "unavailable";
  source?: "OKLink";
  contractName?: string;
  compilerVersion?: string;
  proxy?: boolean;
  detail: string;
};

export type TokenIdentity = {
  chainId: number;
  address: string;
  registry: TokenRegistryEvidence;
  contract: ContractVerificationEvidence;
};
