export function Skeleton({ className = "" }: { className?: string }) {
  return <div className={`animate-pulse bg-paper-2 ${className}`} />;
}

export function MarketCardSkeleton() {
  return (
    <div className="bread-card p-4">
      <Skeleton className="mb-2 h-4 w-24" />
      <Skeleton className="mb-3 h-12 w-full" />
      <div className="mb-3 flex gap-2">
        <Skeleton className="h-14 flex-1" />
        <Skeleton className="h-14 flex-1" />
      </div>
      <Skeleton className="h-4 w-3/4" />
    </div>
  );
}

export function MarketPageSkeleton() {
  return (
    <div className="mx-auto max-w-6xl px-4 py-6">
      <Skeleton className="mb-4 h-4 w-24" />
      <Skeleton className="mb-2 h-10 w-2/3" />
      <Skeleton className="mb-6 h-4 w-1/3" />
      <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
        <div className="space-y-6">
          <Skeleton className="h-64 w-full" />
          <Skeleton className="h-48 w-full" />
        </div>
        <Skeleton className="h-80 w-full" />
      </div>
    </div>
  );
}
