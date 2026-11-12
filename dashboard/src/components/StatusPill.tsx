import React from "react"

export type StatusVariant = "up" | "down" | "neutral" | "degraded"

export interface StatusPillProps {
  variant?: StatusVariant
  children: React.ReactNode
  className?: string
}

export function StatusPill({
  variant = "neutral",
  children,
  className = "",
}: StatusPillProps) {
  let styleClasses = "bg-[var(--color-status-fill-neutral)] text-[var(--color-status-text-neutral)]" // neutral default

  if (variant === "up") {
    styleClasses = "bg-[var(--color-status-fill-up)] text-[var(--color-status-text-up)]"
  } else if (variant === "down") {
    styleClasses = "bg-[var(--color-status-fill-down)] text-[var(--color-status-text-down)]"
  } else if (variant === "degraded") {
    styleClasses = "bg-[var(--color-warning-bg)] text-[var(--color-warning-text)]"
  }

  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium leading-normal ${styleClasses} ${className}`}
    >
      {children}
    </span>
  )
}

export default StatusPill
