export function SkeletonCard({ className = '' }: { className?: string }) {
  return (
    <div className={`bg-bg-card border border-border rounded-xl p-5 animate-pulse ${className}`}>
      <div className="h-4 bg-bg-elevated rounded w-3/4 mb-3" />
      <div className="h-3 bg-bg-elevated rounded w-1/2 mb-2" />
      <div className="h-3 bg-bg-elevated rounded w-2/3" />
    </div>
  );
}

export function SkeletonGrid({ count = 6 }: { count?: number }) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
      {Array.from({ length: count }).map((_, i) => (
        <SkeletonCard key={i} />
      ))}
    </div>
  );
}
