import { useState } from "react";
import { Button } from "@breadcoop/ui";
import { abis } from "../contracts/gen";
import { CT, Resolution, useBalances, type MarketData } from "../hooks/useMarkets";
import { fmtAmount } from "../lib/format";
import { useWallet } from "../lib/wallet";
import { explain } from "./TradeWidget";

/** Your YES/NO shares in this market + the Polymarket-style claim banner. */
export function PositionsPanel({ m }: { m: MarketData }) {
  const wallet = useWallet();
  const { data: bal } = useBalances(wallet.address, m);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!bal || (bal.yes === 0n && bal.no === 0n)) return null;
  const dec = m.collateral.decimals;

  const resolved = m.resolution !== Resolution.Unresolved;
  const winnings =
    bal.payoutDen > 0n ? (bal.yes * bal.payoutYes + bal.no * bal.payoutNo) / bal.payoutDen : 0n;

  const redeem = async () => {
    setBusy(true);
    setError(null);
    try {
      await wallet.write({
        address: CT,
        abi: abis.ConditionalTokens,
        functionName: "redeemPositions",
        args: [m.collateral.address, m.conditionId, [1n, 2n]],
      });
    } catch (e) {
      setError(explain(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="bread-card p-4" data-testid="positions-panel">
      <h3 className="mb-2 font-breadDisplay text-lg font-bold uppercase">Your position</h3>
      <div className="mb-2 grid grid-cols-2 gap-2 text-sm">
        <div className="border-2 border-system-green px-3 py-2">
          <div className="text-caption font-bold uppercase text-system-green">Yes shares</div>
          <div className="text-lg font-black" data-testid="pos-yes">
            {fmtAmount(bal.yes, dec, { dollar: false })}
          </div>
        </div>
        <div className="border-2 border-system-red px-3 py-2">
          <div className="text-caption font-bold uppercase text-system-red">No shares</div>
          <div className="text-lg font-black" data-testid="pos-no">
            {fmtAmount(bal.no, dec, { dollar: false })}
          </div>
        </div>
      </div>

      {resolved && (
        <div className="border-2 border-surface-ink bg-paper-1 p-3">
          {winnings > 0n ? (
            <>
              <div className="mb-2 font-breadDisplay text-lg font-black text-system-green" data-testid="you-won">
                You won {fmtAmount(winnings, dec)}
              </div>
              <Button
                data-testid="redeem"
                variant="positive"
                className="w-full"
                isLoading={busy}
                showChildrenWhenLoading
                onClick={redeem}
              >
                {busy ? "Redeeming" : "Redeem"}
              </Button>
            </>
          ) : (
            <>
              <div className="mb-2 font-bold text-surface-grey-2">
                Your shares are on the losing side — they redeem for $0.
              </div>
              <Button variant="light" className="w-full" isLoading={busy} showChildrenWhenLoading onClick={redeem}>
                {busy ? "Clearing" : "Clear position"}
              </Button>
            </>
          )}
          {error && <div className="mt-2 text-caption text-system-red">{error}</div>}
        </div>
      )}
    </div>
  );
}
