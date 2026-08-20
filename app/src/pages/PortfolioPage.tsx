import React, { useState } from "react";
import { Link } from "react-router-dom";
import { Button, Heading1 } from "@breadcoop/ui";
import { useQueries } from "@tanstack/react-query";
import { parseAbiItem } from "viem";
import { abis } from "../contracts/gen";
import { CT, Resolution, useCash, useMarkets, type MarketData } from "../hooks/useMarkets";
import { fmtAmount, fmtCents } from "../lib/format";
import { publicClient, useWallet } from "../lib/wallet";
import { explain } from "../components/TradeWidget";

interface Row {
  m: MarketData;
  yes: bigint;
  no: bigint;
  lp: bigint;
  fees: bigint;
  payoutDen: bigint;
  payoutYes: bigint;
  payoutNo: bigint;
  // per-outcome average entry price (0..1) and net cost from the user's own trades
  avg: [number, number];
  cost: [bigint, bigint]; // net collateral spent per outcome (buys - sells)
}

const buyEvt = parseAbiItem(
  "event Buy(address indexed buyer, uint256 investmentAmount, uint256 feeAmount, uint256 outcomeIndex, uint256 tokensBought)",
);
const sellEvt = parseAbiItem(
  "event Sell(address indexed seller, uint256 returnAmount, uint256 feeAmount, uint256 outcomeIndex, uint256 tokensSold)",
);

export function PortfolioPage() {
  const wallet = useWallet();
  const { data: markets } = useMarkets();
  const { data: cash } = useCash(wallet.address);
  const [busyId, setBusyId] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  const queries = useQueries({
    queries: (markets ?? []).map((m) => ({
      queryKey: ["portfolio", wallet.address, m.id],
      refetchInterval: 3000,
      queryFn: async (): Promise<Row> => {
        const [yes, no, lp, fees, payoutDen, payoutYes, payoutNo] = (await publicClient.multicall({
          allowFailure: false,
          contracts: [
            { address: CT, abi: abis.ConditionalTokens, functionName: "balanceOf", args: [m.yesPositionId, wallet.address] },
            { address: CT, abi: abis.ConditionalTokens, functionName: "balanceOf", args: [m.noPositionId, wallet.address] },
            { address: m.fpmm, abi: abis.FPMM, functionName: "balanceOf", args: [wallet.address] },
            { address: m.fpmm, abi: abis.FPMM, functionName: "feesWithdrawableBy", args: [wallet.address] },
            { address: CT, abi: abis.ConditionalTokens, functionName: "payoutDenominator", args: [m.conditionId] },
            { address: CT, abi: abis.ConditionalTokens, functionName: "payoutNumerators", args: [m.conditionId, 0n] },
            { address: CT, abi: abis.ConditionalTokens, functionName: "payoutNumerators", args: [m.conditionId, 1n] },
          ],
        })) as [bigint, bigint, bigint, bigint, bigint, bigint, bigint];

        // the user's own trades -> average entry + net cost per outcome
        const [myBuys, mySells] = await Promise.all([
          publicClient.getLogs({ address: m.fpmm, event: buyEvt, args: { buyer: wallet.address }, fromBlock: 0n }),
          publicClient.getLogs({ address: m.fpmm, event: sellEvt, args: { seller: wallet.address }, fromBlock: 0n }),
        ]);
        const boughtShares: [bigint, bigint] = [0n, 0n];
        const boughtCost: [bigint, bigint] = [0n, 0n];
        const cost: [bigint, bigint] = [0n, 0n];
        for (const l of myBuys) {
          const o = Number(l.args.outcomeIndex ?? 0n);
          boughtShares[o] += l.args.tokensBought ?? 0n;
          boughtCost[o] += l.args.investmentAmount ?? 0n;
          cost[o] += l.args.investmentAmount ?? 0n;
        }
        for (const l of mySells) {
          const o = Number(l.args.outcomeIndex ?? 0n);
          cost[o] -= l.args.returnAmount ?? 0n;
        }
        const avg: [number, number] = [
          boughtShares[0] > 0n ? Number(boughtCost[0]) / Number(boughtShares[0]) : 0,
          boughtShares[1] > 0n ? Number(boughtCost[1]) / Number(boughtShares[1]) : 0,
        ];
        return { m, yes, no, lp, fees, payoutDen, payoutYes, payoutNo, avg, cost };
      },
    })),
  });

  const rows = queries.map((q) => q.data).filter((r): r is Row => !!r);
  const positions = rows.filter((r) => r.yes > 0n || r.no > 0n || r.lp > 0n || r.fees > 0n);

  // Dollar value of a row: outcome shares (at payout if resolved, else marginal price)
  // + the LP's proportional slice of the pool + unclaimed fees. Summed as floats so
  // markets with different collateral decimals don't corrupt the total.
  const rowDollars = (r: Row): number => {
    const dec = r.m.collateral.decimals;
    const unit = 10 ** dec;
    const outcome =
      r.payoutDen > 0n
        ? Number(r.yes * r.payoutYes + r.no * r.payoutNo) / Number(r.payoutDen) / unit
        : Number(r.yes * r.m.priceYes + r.no * r.m.priceNo) / 1e18 / unit;
    let lpValue = 0;
    if (r.lp > 0n && r.m.lpSupply > 0n) {
      const yesShare = (r.m.poolYes * r.lp) / r.m.lpSupply;
      const noShare = (r.m.poolNo * r.lp) / r.m.lpSupply;
      lpValue =
        r.payoutDen > 0n
          ? Number(yesShare * r.payoutYes + noShare * r.payoutNo) / Number(r.payoutDen) / unit
          : Number(yesShare * r.m.priceYes + noShare * r.m.priceNo) / 1e18 / unit;
    }
    return outcome + lpValue + Number(r.fees) / unit;
  };
  const totalDollars = positions.reduce((a, r) => a + rowDollars(r), 0);

  // Return = current value + sale proceeds - amount invested (per outcome)
  const returnCell = (r: Row, o: 0 | 1, dec: number) => {
    const shares = o === 0 ? r.yes : r.no;
    const priceNow =
      r.payoutDen > 0n
        ? Number(o === 0 ? r.payoutYes : r.payoutNo) / Number(r.payoutDen)
        : Number(o === 0 ? r.m.priceYes : r.m.priceNo) / 1e18;
    const value = (Number(shares) / 10 ** dec) * priceNow;
    const net = value - Number(r.cost[o]) / 10 ** dec;
    if (r.cost[o] === 0n && shares === 0n) return "—";
    const cls = net >= 0 ? "text-system-green" : "text-system-red";
    return (
      <span className={cls}>
        {net >= 0 ? "+" : "−"}${Math.abs(net).toLocaleString("en-US", { maximumFractionDigits: 2 })}
      </span>
    );
  };

  const redeem = async (r: Row) => {
    setBusyId(r.m.id);
    setError(null);
    try {
      await wallet.write({
        address: CT,
        abi: abis.ConditionalTokens,
        functionName: "redeemPositions",
        args: [r.m.collateral.address, r.m.conditionId, [1n, 2n]],
      });
    } catch (e) {
      setError(explain(e));
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      <Heading1>Your portfolio</Heading1>

      <div className="mb-6 mt-4 flex flex-wrap gap-4">
        <div className="bread-card min-w-44 p-4">
          <div className="text-caption font-bold uppercase text-surface-grey-2">Positions value</div>
          <div className="font-breadDisplay text-2xl font-black" data-testid="portfolio-value">
            ${totalDollars.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </div>
        </div>
        <div className="bread-card min-w-44 p-4">
          <div className="text-caption font-bold uppercase text-surface-grey-2">Cash</div>
          <div className="font-breadDisplay text-2xl font-black" data-testid="portfolio-cash">
            {cash !== undefined ? fmtAmount(cash, 6) : "…"}
          </div>
        </div>
      </div>

      {error && (
        <div className="mb-4 border-2 border-system-red bg-red-0 px-3 py-2 text-sm text-system-red">{error}</div>
      )}

      {positions.length === 0 ? (
        <div className="bread-card p-8 text-center">
          <p className="mb-3 font-bold">You haven't traded any headlines yet.</p>
          <Link to="/">
            <Button variant="secondary">Browse markets</Button>
          </Link>
        </div>
      ) : (
        <div className="bread-card overflow-x-auto" data-testid="portfolio-table">
          <table className="w-full min-w-[640px] text-sm">
            <thead>
              <tr className="border-b-2 border-surface-ink text-left text-caption uppercase text-surface-grey-2">
                <th className="p-3">Market</th>
                <th className="p-3">Outcome</th>
                <th className="p-3 text-right">Qty</th>
                <th className="p-3 text-right">Avg</th>
                <th className="p-3 text-right">Current</th>
                <th className="p-3 text-right">Value</th>
                <th className="p-3 text-right">Return</th>
                <th className="p-3 text-right"></th>
              </tr>
            </thead>
            <tbody>
              {positions.flatMap((r) => {
                const dec = r.m.collateral.decimals;
                const winnings = r.payoutDen > 0n ? (r.yes * r.payoutYes + r.no * r.payoutNo) / r.payoutDen : 0n;
                const isResolved = r.m.resolution !== Resolution.Unresolved;
                const cells: React.ReactElement[] = [];
                const marketCell = (
                  <Link to={`/market/${r.m.id}`} className="font-bold hover:text-core-orange">
                    {r.m.question}
                  </Link>
                );
                if (r.yes > 0n)
                  cells.push(
                    <tr key={`${r.m.id}-yes`} className="border-b border-paper-2">
                      <td className="max-w-72 p-3">{marketCell}</td>
                      <td className="p-3 font-bold text-system-green">Yes</td>
                      <td className="p-3 text-right">{fmtAmount(r.yes, dec, { dollar: false })}</td>
                      <td className="p-3 text-right">{r.avg[0] > 0 ? `${Math.round(r.avg[0] * 100)}¢` : "—"}</td>
                      <td className="p-3 text-right">
                        {isResolved
                          ? r.payoutYes > 0n
                            ? "100¢"
                            : "0¢"
                          : fmtCents(r.m.priceYes)}
                      </td>
                      <td className="p-3 text-right">
                        {fmtAmount(
                          isResolved
                            ? r.payoutDen > 0n
                              ? (r.yes * r.payoutYes) / r.payoutDen
                              : 0n
                            : (r.yes * r.m.priceYes) / 10n ** 18n,
                          dec,
                        )}
                      </td>
                      <td className="p-3 text-right">{returnCell(r, 0, dec)}</td>
                      <td className="p-3 text-right">
                        {isResolved && (
                          <Button
                            size="sm"
                            variant={winnings > 0n ? "positive" : "light"}
                            isLoading={busyId === r.m.id}
                            onClick={() => redeem(r)}
                            data-testid={`redeem-${r.m.id}`}
                          >
                            {winnings > 0n ? `Redeem ${fmtAmount(winnings, dec)}` : "Clear"}
                          </Button>
                        )}
                      </td>
                    </tr>,
                  );
                if (r.no > 0n)
                  cells.push(
                    <tr key={`${r.m.id}-no`} className="border-b border-paper-2">
                      <td className="max-w-72 p-3">{marketCell}</td>
                      <td className="p-3 font-bold text-system-red">No</td>
                      <td className="p-3 text-right">{fmtAmount(r.no, dec, { dollar: false })}</td>
                      <td className="p-3 text-right">{r.avg[1] > 0 ? `${Math.round(r.avg[1] * 100)}¢` : "—"}</td>
                      <td className="p-3 text-right">
                        {isResolved ? (r.payoutNo > 0n ? "100¢" : "0¢") : fmtCents(r.m.priceNo)}
                      </td>
                      <td className="p-3 text-right">
                        {fmtAmount(
                          isResolved
                            ? r.payoutDen > 0n
                              ? (r.no * r.payoutNo) / r.payoutDen
                              : 0n
                            : (r.no * r.m.priceNo) / 10n ** 18n,
                          dec,
                        )}
                      </td>
                      <td className="p-3 text-right">{returnCell(r, 1, dec)}</td>
                      <td className="p-3 text-right">
                        {isResolved && r.yes === 0n && (
                          <Button
                            size="sm"
                            variant={winnings > 0n ? "positive" : "light"}
                            isLoading={busyId === r.m.id}
                            onClick={() => redeem(r)}
                            data-testid={`redeem-${r.m.id}`}
                          >
                            {winnings > 0n ? `Redeem ${fmtAmount(winnings, dec)}` : "Clear"}
                          </Button>
                        )}
                      </td>
                    </tr>,
                  );
                if (r.lp > 0n || r.fees > 0n)
                  cells.push(
                    <tr key={`${r.m.id}-lp`} className="border-b border-paper-2">
                      <td className="max-w-72 p-3">{marketCell}</td>
                      <td className="p-3 font-bold text-primary-jade">LP</td>
                      <td className="p-3 text-right">{fmtAmount(r.lp, dec, { dollar: false })}</td>
                      <td className="p-3 text-right">—</td>
                      <td className="p-3 text-right">—</td>
                      <td className="p-3 text-right">
                        {r.fees > 0n ? `${fmtAmount(r.fees, dec)} fees` : "—"}
                      </td>
                      <td className="p-3 text-right">—</td>
                      <td className="p-3 text-right">
                        <Link to={`/market/${r.m.id}`} className="text-caption font-bold text-core-orange underline">
                          Manage
                        </Link>
                      </td>
                    </tr>,
                  );
                return cells;
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
