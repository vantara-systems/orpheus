import React from "react"

export interface StatItem {
  label: string
  value: React.ReactNode
  loading?: boolean
}

export interface StatRowProps {
  stats?: StatItem[]
  children?: React.ReactNode
  className?: string
}

export function StatRow({ stats, children, className = "" }: StatRowProps) {
  if (stats && stats.length > 0) {
    return (
      <div
        className={`grid grid-cols-1 md:grid-cols-${stats.length} divide-y md:divide-y-0 md:divide-x divide-[var(--color-border)] ${className}`}
        style={{
          gridTemplateColumns: `repeat(${stats.length}, minmax(0, 1fr))`,
        }}
      >
        {stats.map((stat, i) => (
          <div key={i} className="p-5 sm:p-6">
            <div className="text-xs font-medium text-[var(--color-muted)]">{stat.label}</div>
            {stat.loading ? (
              <div className="mt-2 h-7 w-20 bg-[var(--color-border)] animate-pulse rounded" />
            ) : (
              <div className="mt-1 text-2xl font-semibold tracking-tight text-[var(--color-text)] tabular-nums">
                {stat.value}
              </div>
            )}
          </div>
        ))}
      </div>
    )
  }

  return (
    <div
      className={`grid grid-cols-1 md:grid-cols-3 divide-y md:divide-y-0 md:divide-x divide-[var(--color-border)] ${className}`}
    >
      {children}
    </div>
  )
}

export default StatRow
