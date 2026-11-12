import React from "react"

export interface PanelProps {
  children: React.ReactNode
  className?: string
  id?: string
}

export function Panel({ children, className = "", id }: PanelProps) {
  return (
    <div
      id={id}
      className={`bg-[var(--color-panel)] border border-[var(--color-border)] rounded-[10px] shadow-xs overflow-hidden ${className}`}
    >
      {children}
    </div>
  )
}

export default Panel
