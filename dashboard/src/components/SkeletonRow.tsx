export interface SkeletonRowProps {
  count?: number
  className?: string
}

export function SkeletonRow({ count = 3, className = "" }: SkeletonRowProps) {
  return (
    <div className={`divide-y divide-[var(--color-border)] ${className}`}>
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="p-5 sm:p-6 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="w-44 space-y-2">
            <div className="h-5 bg-[var(--color-border)] animate-pulse rounded w-32" />
            <div className="h-4 bg-[var(--color-status-fill-neutral)] animate-pulse rounded w-20" />
          </div>
          <div className="h-8 bg-[var(--color-status-fill-neutral)] animate-pulse rounded w-full max-w-xl" />
          <div className="h-5 bg-[var(--color-border)] animate-pulse rounded w-16" />
        </div>
      ))}
    </div>
  )
}

export default SkeletonRow
