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
  let styleClasses = "bg-[#eef0f3] text-[#3b4350]" // neutral default

  if (variant === "up") {
    styleClasses = "bg-[#e6f4ec] text-[#0d6b43]"
  } else if (variant === "down") {
    styleClasses = "bg-[#fdecea] text-[#b42318]"
  } else if (variant === "degraded") {
    styleClasses = "bg-[#fef3c7] text-[#92400e]"
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
