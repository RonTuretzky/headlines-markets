import { defineChain } from "viem";
import { deployment } from "./contracts/gen";

export const RPC_URL = import.meta.env.VITE_RPC_URL ?? "http://localhost:8547";

export const localChain = defineChain({
  id: 31337,
  name: "Anvil",
  nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 },
  rpcUrls: { default: { http: [RPC_URL] } },
  contracts: {
    multicall3: { address: deployment.multicall3 },
  },
});

/// Anvil's canonical, publicly-known dev accounts (never use on a real network).
/// Account #0 deploys and seeds; #1-#3 are the demo users.
export const DEV_ACCOUNTS = [
  {
    name: "Alice",
    pk: "0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d" as const,
  },
  {
    name: "Bob",
    pk: "0x5de4111afa1a4b94908f83103eb1f1706367c2e68ca870fc3fb9a804cdab365a" as const,
  },
  {
    name: "Carol",
    pk: "0x7c852118294e51e653712a81e05800f419141751be58f605c371e15141b007a6" as const,
  },
];
