import { useQuery } from "@tanstack/react-query";
import { DEPLOY_BLOCK } from "../config";
import { parseAbiItem, type Address } from "viem";
import { abis } from "../contracts/gen";
import { publicClient } from "../lib/wallet";
import type { MarketData } from "./useMarkets";

export interface PricePoint {
  ts: number; // unix seconds
  price: number; // YES price 0..1
}

export interface TradeActivity {
  ts: number;
  kind: "buy" | "sell" | "funding";
  trader: Address;
  outcome: number; // 0 yes, 1 no (funding: -1)
  amount: bigint; // collateral units
  shares: bigint;
  price: number; // effective price 0..1 (trades)
  txHash: string;
}

const buyEvent = parseAbiItem(
  "event Buy(address indexed buyer, uint256 investmentAmount, uint256 feeAmount, uint256 outcomeIndex, uint256 tokensBought)",
);
const sellEvent = parseAbiItem(
  "event Sell(address indexed seller, uint256 returnAmount, uint256 feeAmount, uint256 outcomeIndex, uint256 tokensSold)",
);
const fundingEvent = parseAbiItem("event FundingAdded(address indexed funder, uint256 amountAdded, uint256 sharesMinted)");

/**
 * Reconstructs the YES price series exactly: every pool-changing event's block gets a
 * historical `marginalPrice` eth_call (anvil serves archive state). Fine for a local
 * chain; a real deployment uses the indexer (backlog E3).
 */
export function usePriceHistory(m?: MarketData) {
  return useQuery({
    queryKey: ["history", m?.id, m ? String(m.volume) : "", m ? String(m.resolution) : ""],
    enabled: !!m,
    staleTime: 10_000,
    queryFn: async () => {
      if (!m) throw new Error("no market");
      const [buys, sells, fundings] = await Promise.all([
        publicClient.getLogs({ address: m.fpmm, event: buyEvent, fromBlock: DEPLOY_BLOCK }),
        publicClient.getLogs({ address: m.fpmm, event: sellEvent, fromBlock: DEPLOY_BLOCK }),
        publicClient.getLogs({ address: m.fpmm, event: fundingEvent, fromBlock: DEPLOY_BLOCK }),
      ]);
      const blocks = [...new Set([...buys, ...sells, ...fundings].map((l) => l.blockNumber))].sort((a, b) =>
        a < b ? -1 : 1,
      );

      // one getBlock + one historical price call per pool-changing block
      const tsByBlock = new Map<bigint, number>();
      const points: PricePoint[] = [];
      for (const bn of blocks) {
        const [block, price] = await Promise.all([
          publicClient.getBlock({ blockNumber: bn }),
          publicClient
            .readContract({
              address: m.fpmm,
              abi: abis.FPMM,
              functionName: "marginalPrice",
              args: [0n],
              blockNumber: bn,
            })
            .catch(() => null),
        ]);
        tsByBlock.set(bn, Number(block.timestamp));
        if (price !== null) points.push({ ts: Number(block.timestamp), price: Number(price) / 1e18 });
      }

      const activity: TradeActivity[] = [
        ...buys.map((l) => {
          const inv = l.args.investmentAmount ?? 0n;
          const shares = l.args.tokensBought ?? 0n;
          return {
            ts: tsByBlock.get(l.blockNumber) ?? 0,
            kind: "buy" as const,
            trader: l.args.buyer as Address,
            outcome: Number(l.args.outcomeIndex ?? 0n),
            amount: inv,
            shares,
            price: shares > 0n ? Number(inv) / Number(shares) : 0,
            txHash: l.transactionHash,
          };
        }),
        ...sells.map((l) => {
          const ret = l.args.returnAmount ?? 0n;
          const shares = l.args.tokensSold ?? 0n;
          return {
            ts: tsByBlock.get(l.blockNumber) ?? 0,
            kind: "sell" as const,
            trader: l.args.seller as Address,
            outcome: Number(l.args.outcomeIndex ?? 0n),
            amount: ret,
            shares,
            price: shares > 0n ? Number(ret) / Number(shares) : 0,
            txHash: l.transactionHash,
          };
        }),
        ...fundings.map((l) => ({
          ts: tsByBlock.get(l.blockNumber) ?? 0,
          kind: "funding" as const,
          trader: l.args.funder as Address,
          outcome: -1,
          amount: l.args.amountAdded ?? 0n,
          shares: l.args.sharesMinted ?? 0n,
          price: 0,
          txHash: l.transactionHash,
        })),
      ].sort((a, b) => b.ts - a.ts);

      // resolution pins the end of the series at $1.00 / $0.00
      if (m.resolution === 1) points.push({ ts: Number(m.chainNow), price: 1 });
      if (m.resolution === 2) points.push({ ts: Number(m.chainNow), price: 0 });
      // live tail so the line reaches "now"
      if (m.resolution === 0 && points.length > 0) {
        points.push({ ts: Number(m.chainNow), price: Number(m.priceYes) / 1e18 });
      }
      return { points, activity };
    },
  });
}
