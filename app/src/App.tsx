import { HashRouter, Route, Routes } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Header } from "./components/Header";
import { WalletProvider } from "./lib/wallet";
import { CreatePage } from "./pages/CreatePage";
import { MarketPage } from "./pages/MarketPage";
import { MarketsPage } from "./pages/MarketsPage";
import { PortfolioPage } from "./pages/PortfolioPage";

const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: 1, staleTime: 1000 } },
});

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <WalletProvider>
        <HashRouter>
          <div className="min-h-screen">
            <Header />
            <Routes>
              <Route path="/" element={<MarketsPage />} />
              <Route path="/market/:id" element={<MarketPage />} />
              <Route path="/create" element={<CreatePage />} />
              <Route path="/portfolio" element={<PortfolioPage />} />
            </Routes>
            <footer className="mt-12 border-t-2 border-surface-ink bg-paper-0 px-4 py-6 text-center text-caption text-surface-grey-2">
              Headlines — prediction markets settled by zkEmail proofs of newspaper breaking-news alerts.
              Local demo: mock verifier + anvil. Built on the Conditional Tokens model Polymarket uses.
            </footer>
          </div>
        </HashRouter>
      </WalletProvider>
    </QueryClientProvider>
  );
}
