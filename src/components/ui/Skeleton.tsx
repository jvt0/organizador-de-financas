type SkeletonProps = {
  className?: string
}

export function Skeleton({ className = '' }: SkeletonProps) {
  return (
    <div
      className={`animate-pulse rounded bg-surface2 ${className}`}
      aria-hidden="true"
    />
  )
}

export function SkeletonRow() {
  return (
    <div className="flex items-center gap-4 px-4 py-3 border-b border-border">
      <Skeleton className="h-3 w-24" />
      <Skeleton className="h-3 flex-1" />
      <Skeleton className="h-3 w-20" />
      <Skeleton className="h-3 w-16" />
    </div>
  )
}

export function SkeletonCard() {
  return (
    <div className="bg-surface border border-border rounded-xl p-5">
      <Skeleton className="h-3 w-24 mb-3" />
      <Skeleton className="h-7 w-36" />
    </div>
  )
}
