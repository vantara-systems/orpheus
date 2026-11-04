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
      className={`bg-[#ffffff] border border-[#e6e9ee] rounded-[10px] shadow-xs overflow-hidden ${className}`}
    >
      {children}
    </div>
  )
}

export default Panel
