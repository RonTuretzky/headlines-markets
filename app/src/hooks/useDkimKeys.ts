import { useQuery } from "@tanstack/react-query";
import { parseAbiItem, type Hex } from "viem";
import { deployment } from "../contracts/gen";
import { publicClient } from "../lib/wallet";

const registeredEvent = parseAbiItem(
  "event DKIMKeyRegistered(string domainName, bytes32 indexed publicKeyHash, string selector)",
);

export interface DkimKey {
  domain: string;
  selector: string;
  publicKeyHash: Hex;
}

/** Registered DKIM public keys, read from the registry's events. Used to resolve an
 * uploaded email's (domain, selector) → the publicKeyHash the onchain verifier checks. */
export function useDkimKeys() {
  return useQuery({
    queryKey: ["dkim-keys"],
    staleTime: 60_000,
    queryFn: async (): Promise<DkimKey[]> => {
      const logs = await publicClient.getLogs({
        address: deployment.dkimRegistry as Hex,
        event: registeredEvent,
        fromBlock: 0n,
      });
      return logs.map((l) => ({
        domain: l.args.domainName as string,
        selector: l.args.selector as string,
        publicKeyHash: l.args.publicKeyHash as Hex,
      }));
    },
  });
}

export function resolveKey(keys: DkimKey[] | undefined, domain: string, selector: string): Hex | null {
  return keys?.find((k) => k.domain === domain && k.selector === selector)?.publicKeyHash ?? null;
}
