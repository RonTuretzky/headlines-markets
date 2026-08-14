// Local dev wallet: viem clients over anvil's well-known accounts, with an
// account switcher in the header. Production wallet connectors (RainbowKit via
// bread-ui-kit's LoginButton/Navbar) are a backlog item — see docs/BACKLOG.md.
import { createContext, useContext, useMemo, useState, type ReactNode } from "react";
import {
  createPublicClient,
  createWalletClient,
  http,
  publicActions,
  type Abi,
  type Address,
  type PublicClient,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { useQueryClient } from "@tanstack/react-query";
import { DEV_ACCOUNTS, localChain, RPC_URL } from "../config";

export const publicClient: PublicClient = createPublicClient({
  chain: localChain,
  transport: http(RPC_URL),
});

interface WalletCtx {
  accountIndex: number;
  accountName: string;
  address: Address;
  setAccountIndex: (i: number) => void;
  /** Sends a tx, waits for the receipt, invalidates queries. Throws on revert. */
  write: (args: { address: Address; abi: Abi; functionName: string; args?: readonly unknown[] }) => Promise<void>;
}

const Ctx = createContext<WalletCtx | null>(null);

export function WalletProvider({ children }: { children: ReactNode }) {
  const [accountIndex, setAccountIndex] = useState(0);
  const queryClient = useQueryClient();

  const value = useMemo<WalletCtx>(() => {
    const account = privateKeyToAccount(DEV_ACCOUNTS[accountIndex].pk);
    const walletClient = createWalletClient({
      account,
      chain: localChain,
      transport: http(RPC_URL),
    }).extend(publicActions);

    return {
      accountIndex,
      accountName: DEV_ACCOUNTS[accountIndex].name,
      address: account.address,
      setAccountIndex,
      write: async ({ address, abi, functionName, args }) => {
        // simulate first for a readable revert reason
        const { request } = await walletClient.simulateContract({
          address,
          abi,
          functionName,
          args: args ?? [],
          account,
        });
        const hash = await walletClient.writeContract(request);
        const receipt = await walletClient.waitForTransactionReceipt({ hash });
        if (receipt.status !== "success") throw new Error("Transaction reverted");
        await queryClient.invalidateQueries();
      },
    };
  }, [accountIndex, queryClient]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useWallet(): WalletCtx {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useWallet outside WalletProvider");
  return ctx;
}
