export default function Loading() {
  return (
    <div className="space-y-6 animate-pulse">
      {/* Header skeleton */}
      <div>
        <div className="h-4 w-32 bg-muted rounded mb-2" />
        <div className="h-7 w-56 bg-muted rounded mb-2" />
        <div className="h-4 w-44 bg-muted rounded" />
      </div>

      {/* Cards row skeleton */}
      <div className="grid gap-3 grid-cols-2">
        <div className="h-28 bg-muted rounded-xl" />
        <div className="h-28 bg-muted rounded-xl" />
      </div>

      {/* List skeleton */}
      <div className="space-y-2">
        <div className="h-5 w-36 bg-muted rounded" />
        {[1, 2, 3].map(i => (
          <div key={i} className="h-16 bg-muted rounded-xl" />
        ))}
      </div>

      {/* More cards */}
      <div className="grid gap-3 grid-cols-2">
        <div className="h-24 bg-muted rounded-xl" />
        <div className="h-24 bg-muted rounded-xl" />
      </div>
    </div>
  );
}
