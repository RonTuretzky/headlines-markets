import { useState } from "react";
import { Button } from "@breadcoop/ui";
import { maxUint256 } from "viem";
import { abis } from "../contracts/gen";
import { Resolution, useBalances, type MarketData } from "../hooks/useMarkets";
import { fmtAmount, parseAmount } from "../lib/format";
import { publicClient, useWallet } from "../lib/wallet";
import { explain } from "./TradeWidget";

export function LiquidityPanel({ m }: { m: MarketData }) {
  const wallet = useWallet();
  const { data: bal } = useBalances(wallet.address, m);
  const [addAmt, setAddAmt] = useState("");
  const [removeAmt, setRemoveAmt] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const dec = m.collateral.decimals;
  const tradingOpen = m.resolution === Resolution.Unresolved;

  const run = async (label: string, fn: () => Promise<void>) => {
    setBusy(label);
    setError(null);
    try {
      await fn();
    } catch (e) {
      setError(explain(e));
    } finally {
      setBusy(null);
    }
  };

  const addLiquidity = () =>
    run("add", async () => {
      const units = parseAmount(addAmt, dec);
      if (!units) throw new Error("Must specify amount");
      const allowance = (await publicClient.readContract({
        address: m.collateral.address,
        abi: abis.TestUSDC,
        functionName: "allowance",
        args: [wallet.address, m.fpmm],
      })) as bigint;
      if (allowance < units) {
        await wallet.write({
          address: m.collateral.address,
          abi: abis.TestUSDC,
          functionName: "approve",
          args: [m.fpmm, maxUint256],
        });
      }
      await wallet.write({
        address: m.fpmm,
        abi: abis.FPMM,
        functionName: "addFunding",
        args: [units, [], wallet.address],
      });
      setAddAmt("");
    });

  const removeLiquidity = () =>
    run("remove", async () => {
      const units = parseAmount(removeAmt, dec); // LP shares are collateral-scale (Gnosis convention)
      if (!units) throw new Error("Must specify amount");
      await wallet.write({ address: m.fpmm, abi: abis.FPMM, functionName: "removeFunding", args: [units] });
      setRemoveAmt("");
    });

  const claimFees = () =>
    run("fees", async () => {
      await wallet.write({
        address: m.fpmm,
        abi: abis.FPMM,
        functionName: "withdrawFees",
        args: [wallet.address],
      });
    });

  return (
    <div className="bread-card p-4" data-testid="liquidity-panel">
      <h3 className="mb-2 font-breadDisplay text-lg font-bold uppercase">Liquidity</h3>
      <div className="mb-3 grid grid-cols-2 gap-x-3 gap-y-1 text-sm">
        <span className="text-surface-grey-2">Pool YES / NO</span>
        <span>
          {fmtAmount(m.poolYes, dec, { dollar: false })} / {fmtAmount(m.poolNo, dec, { dollar: false })}
        </span>
        <span className="text-surface-grey-2">Your LP shares</span>
        <span data-testid="lp-shares">{bal ? fmtAmount(bal.lp, dec, { dollar: false }) : "…"}</span>
        <span className="text-surface-grey-2">Claimable fees</span>
        <span data-testid="claimable-fees">{bal ? fmtAmount(bal.fees, dec) : "…"}</span>
      </div>

      {tradingOpen && (
        <div className="mb-2 flex gap-2">
          <input
            data-testid="add-liquidity-amount"
            placeholder={`Amount (${m.collateral.symbol})`}
            value={addAmt}
            onChange={(e) => setAddAmt(e.target.value)}
            className="min-w-0 flex-1 border-2 border-surface-ink bg-paper-0 px-2 py-1.5 text-sm outline-none"
          />
          <Button
            size="sm"
            data-testid="add-liquidity"
            isLoading={busy === "add"}
            showChildrenWhenLoading
            onClick={addLiquidity}
          >
            Add
          </Button>
        </div>
      )}
      <div className="mb-2 flex gap-2">
        <input
          data-testid="remove-liquidity-amount"
          placeholder="LP shares"
          value={removeAmt}
          onChange={(e) => setRemoveAmt(e.target.value)}
          className="min-w-0 flex-1 border-2 border-surface-ink bg-paper-0 px-2 py-1.5 text-sm outline-none"
        />
        <Button
          size="sm"
          variant="secondary"
          data-testid="remove-liquidity"
          isLoading={busy === "remove"}
          showChildrenWhenLoading
          onClick={removeLiquidity}
        >
          Remove
        </Button>
      </div>
      {bal && bal.fees > 0n && (
        <Button size="sm" variant="light" data-testid="claim-fees" isLoading={busy === "fees"} onClick={claimFees}>
          Claim fees {fmtAmount(bal.fees, dec)}
        </Button>
      )}
      {error && (
        <div className="mt-2 border-2 border-system-red bg-red-0 px-2 py-1 text-caption text-system-red">{error}</div>
      )}
      <p className="mt-2 text-caption text-surface-grey-2">
        LPs earn the {Number(m.fee) / 1e16}% trading fee. Removing liquidity returns YES + NO shares (merge or
        redeem them after resolution).
      </p>
    </div>
  );
}
