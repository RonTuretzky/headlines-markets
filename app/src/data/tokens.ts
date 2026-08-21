import type { Address } from "viem";

// Collateral tokens offered per chain. Markets can use any ERC-20; these are the
// curated choices the create wizard exposes. Local + Sepolia use the faucet
// TestUSDC; Gnosis uses real, onchain-verified stablecoins.
export interface TokenInfo {
  symbol: string;
  address: Address;
  decimals: number;
  faucet?: boolean; // has a public faucet() (TestUSDC only)
  note?: string;
}

// Gnosis mainnet (chain 100) — addresses verified onchain (symbol()/decimals()).
export const GNOSIS_TOKENS: TokenInfo[] = [
  { symbol: "WXDAI", address: "0xe91D153E0b41518A2Ce8Dd3D7944Fa863463a97d", decimals: 18, note: "Wrapped xDAI — Gnosis's native stablecoin" },
  { symbol: "USDC", address: "0xDDAfbb505ad214D7b80b1f830fcCc89B60fb7A83", decimals: 6, note: "Bridged USDC" },
  { symbol: "USDC.e", address: "0x2a22f9c3b484c3629090FeED35F17Ff8F88f76F0", decimals: 6, note: "Circle-bridged USDC" },
  { symbol: "sDAI", address: "0xaf204776c7245bF4147c2612BF6e5972Ee483701", decimals: 18, note: "Savings DAI (yield-bearing)" },
  { symbol: "EURe", address: "0x420CA0f9B9b604cE0fd9C18EF134C705e5Fa3430", decimals: 18, note: "Monerium EUR (euro stablecoin)" },
];

/** Collateral options for a chain. `usdcAddress` is the deployment's default/faucet token. */
export function tokensForChain(chainId: number, usdcAddress: Address): TokenInfo[] {
  if (chainId === 100) return GNOSIS_TOKENS;
  if (chainId === 11155111)
    return [{ symbol: "USDC", address: usdcAddress, decimals: 6, faucet: true, note: "Sepolia test USDC — free from the header faucet" }];
  return [{ symbol: "USDC", address: usdcAddress, decimals: 6, faucet: true, note: "Test USDC (faucet)" }];
}
