import { HashRouter, Route, Routes, useLocation } from "react-router-dom";
import type React from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Header } from "./components/Header";
import { ToastProvider } from "./components/Toast";
import { WalletProvider } from "./lib/wallet";
import { CreatePage } from "./pages/CreatePage";
import { MarketPage } from "./pages/MarketPage";
import { MarketsPage } from "./pages/MarketsPage";
import { PortfolioPage } from "./pages/PortfolioPage";

const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: 1, staleTime: 1000 } },
});

function Page({ children }: { children: React.ReactNode }) {
  const { pathname } = useLocation();
  return (
    <main key={pathname} data-page>
      {children}
    </main>
  );
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <WalletProvider>
        <ToastProvider>
        <HashRouter>
          <div className="min-h-screen">
            <Header />
            <Routes>
              <Route path="/" element={<Page><MarketsPage /></Page>} />
              <Route path="/market/:id" element={<Page><MarketPage /></Page>} />
              <Route path="/create" element={<Page><CreatePage /></Page>} />
              <Route path="/portfolio" element={<Page><PortfolioPage /></Page>} />
            </Routes>
            <footer className="mt-12 border-t-2 border-surface-ink bg-paper-0 px-4 py-6 text-center text-caption text-surface-grey-2">
              Headlines — prediction markets settled by zkEmail proofs of newspaper breaking-news alerts.
              Local demo on anvil: real DKIM (RSA-SHA256) signatures verified onchain, Conditional Tokens settlement à la Polymarket.
            </footer>
          </div>
        </HashRouter>
        </ToastProvider>
      </WalletProvider>
    </QueryClientProvider>
  );
}
