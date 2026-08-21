// Wallet layer. On the local chain (anvil) it uses the well-known dev accounts with a
// header switcher. On a real chain (Gnosis) it connects the browser's injected wallet
// (MetaMask/Rabby/…) and sends real transactions.
import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";
import {
  createPublicClient,
  createWalletClient,
  custom,
  http,
  publicActions,
  type Abi,
  type Address,
  type PublicClient,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { useQueryClient } from "@tanstack/react-query";
import { chain, DEV_ACCOUNTS, IS_LOCAL, RPC_URL } from "../config";

export const publicClient: PublicClient = createPublicClient({ chain, transport: http(RPC_URL) });

type Eip1193 = { request(args: { method: string; params?: unknown[] }): Promise<unknown> };
const injected = (): Eip1193 | undefined => (globalThis as { ethereum?: Eip1193 }).ethereum;

interface WalletCtx {
  isLocal: boolean;
  accountIndex: number;
  accountName: string;
  address: Address;
  connected: boolean;
  setAccountIndex: (i: number) => void;
  connect: () => Promise<void>;
  write: (args: { address: Address; abi: Abi; functionName: string; args?: readonly unknown[]; value?: bigint }) => Promise<void>;
}

const Ctx = createContext<WalletCtx | null>(null);

export function WalletProvider({ children }: { children: ReactNode }) {
  const [accountIndex, setAccountIndex] = useState(0);
  const [injectedAddress, setInjectedAddress] = useState<Address | null>(null);
  const queryClient = useQueryClient();

  const connect = useCallback(async () => {
    const eth = injected();
    if (!eth) throw new Error("No browser wallet found — install MetaMask or Rabby");
    const accounts = (await eth.request({ method: "eth_requestAccounts" })) as Address[];
    // ensure the wallet is on Gnosis (chain 100)
    const hexId = `0x${chain.id.toString(16)}`;
    try {
      await eth.request({ method: "wallet_switchEthereumChain", params: [{ chainId: hexId }] });
    } catch {
      /* user may reject or chain already selected */
    }
    setInjectedAddress(accounts[0] ?? null);
  }, []);

  const value = useMemo<WalletCtx>(() => {
    const localAccount = IS_LOCAL ? privateKeyToAccount(DEV_ACCOUNTS[accountIndex].pk) : null;
    const address = (IS_LOCAL ? localAccount!.address : (injectedAddress ?? "0x0000000000000000000000000000000000000000")) as Address;

    const walletClient = () => {
      if (IS_LOCAL) {
        return createWalletClient({ account: localAccount!, chain, transport: http(RPC_URL) }).extend(publicActions);
      }
      const eth = injected();
      if (!eth || !injectedAddress) throw new Error("Connect a wallet first");
      return createWalletClient({ account: injectedAddress, chain, transport: custom(eth) }).extend(publicActions);
    };

    return {
      isLocal: IS_LOCAL,
      accountIndex,
      accountName: IS_LOCAL ? DEV_ACCOUNTS[accountIndex].name : shortAddr(injectedAddress),
      address,
      connected: IS_LOCAL || !!injectedAddress,
      setAccountIndex,
      connect,
      write: async ({ address: to, abi, functionName, args, value }) => {
        const wc = walletClient();
        const { request } = await wc.simulateContract({
          address: to,
          abi,
          functionName,
          args: args ?? [],
          account: (IS_LOCAL ? localAccount! : injectedAddress) as Address,
          value,
        });
        const hash = await wc.writeContract(request);
        const receipt = await wc.waitForTransactionReceipt({ hash });
        if (receipt.status !== "success") throw new Error("Transaction reverted");
        await queryClient.invalidateQueries();
      },
    };
  }, [accountIndex, injectedAddress, connect, queryClient]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useWallet(): WalletCtx {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useWallet outside WalletProvider");
  return ctx;
}

function shortAddr(a: Address | null): string {
  return a ? `${a.slice(0, 6)}…${a.slice(-4)}` : "Connect";
}
