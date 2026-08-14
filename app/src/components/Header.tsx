import { Link, NavLink } from "react-router-dom";
import { Button, Chip, Logo } from "@breadcoop/ui";
import { Newspaper } from "@phosphor-icons/react";
import { DEV_ACCOUNTS } from "../config";
import { useWallet } from "../lib/wallet";
import { useCash, USDC } from "../hooks/useMarkets";
import { abis } from "../contracts/gen";
import { fmtAmount } from "../lib/format";
import { useState } from "react";

export function Header() {
  const wallet = useWallet();
  const { data: cash } = useCash(wallet.address);
  const [fauceting, setFauceting] = useState(false);

  const faucet = async () => {
    setFauceting(true);
    try {
      await wallet.write({ address: USDC, abi: abis.TestUSDC, functionName: "faucet" });
    } finally {
      setFauceting(false);
    }
  };

  const navClass = ({ isActive }: { isActive: boolean }) =>
    `font-breadDisplay font-bold uppercase tracking-wide px-2 py-1 ${
      isActive ? "text-core-orange underline underline-offset-4" : "text-surface-ink hover:text-core-orange"
    }`;

  return (
    <header className="border-b-2 border-surface-ink bg-paper-0">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-3 px-4 py-3">
        <Link to="/" className="flex items-center gap-2">
          <Logo size={30} color="orange" />
          <span className="font-breadDisplay text-xl font-black uppercase tracking-tight">Headlines</span>
          <Chip size="small">
            <span className="flex items-center gap-1">
              <Newspaper size={12} /> zkEmail settled
            </span>
          </Chip>
        </Link>

        <nav className="ml-2 flex items-center gap-1 text-sm">
          <NavLink to="/" end className={navClass}>
            Markets
          </NavLink>
          <NavLink to="/create" className={navClass}>
            Create
          </NavLink>
          <NavLink to="/portfolio" className={navClass}>
            Portfolio
          </NavLink>
        </nav>

        <div className="ml-auto flex items-center gap-3">
          <div className="text-right">
            <div className="text-caption text-surface-grey-2">Cash</div>
            <div className="font-bold" data-testid="cash-balance">
              {cash !== undefined ? fmtAmount(cash, 6) : "…"}
            </div>
          </div>
          <Button size="sm" variant="secondary" onClick={faucet} isLoading={fauceting} data-testid="faucet">
            Faucet +$10k
          </Button>
          <select
            aria-label="Dev account"
            data-testid="account-switcher"
            className="border-2 border-surface-ink bg-paper-0 px-2 py-1.5 text-sm font-bold shadow-[0.125rem_0.125rem_0px_0px_#595959]"
            value={wallet.accountIndex}
            onChange={(e) => wallet.setAccountIndex(Number(e.target.value))}
          >
            {DEV_ACCOUNTS.map((a, i) => (
              <option key={a.name} value={i}>
                {a.name}
              </option>
            ))}
          </select>
        </div>
      </div>
    </header>
  );
}
