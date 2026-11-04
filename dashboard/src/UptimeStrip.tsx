import { Tooltip, TooltipProvider } from "@cloudflare/kumo"
import type { BucketStatus, UptimeBucket } from "./types"

export interface UptimeStripProps {
  projectName: string
  uptimePercent: number
  buckets?: UptimeBucket[]
  incidentCount?: number
  className?: string
}

const STATUS_COLORS: Record<BucketStatus, string> = {
  up: "#1a9b5f",
  degraded: "#e5a100",
  down: "#d1382c",
  no_data: "#d9e0e7",
}

const STATUS_LABELS: Record<BucketStatus, string> = {
  up: "Up",
  degraded: "Degraded",
  down: "Down",
  no_data: "No data",
}

function formatTime(isoString: string): string {
  if (!isoString) return ""
  const date = new Date(isoString)
  if (isNaN(date.getTime())) return ""
  return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", hour12: false })
}

function formatRange(start: string, end: string): string {
  if (!start && !end) return "No time data"
  const startDate = new Date(start)
  const dateStr = !isNaN(startDate.getTime())
    ? startDate.toLocaleDateString([], { month: "short", day: "numeric" })
    : ""
  const startTime = formatTime(start)
  const endTime = formatTime(end)
  return `${dateStr ? `${dateStr} ` : ""}${startTime} – ${endTime}`
}

function getChecksDescription(checks: number, failed: number, status: BucketStatus): string {
  if (checks === 0 || status === "no_data") {
    return "No checks recorded"
  }
  if (failed === 0) {
    return `${checks} checks (0 failed)`
  }
  return `${failed} failed of ${checks} checks`
}

export default function UptimeStrip({
  projectName,
  uptimePercent,
  buckets = [],
  incidentCount = 0,
  className = "",
}: UptimeStripProps) {
  // Ensure we have 60 buckets (fallback to no_data if missing)
  const totalBuckets = 60
  const normalizedBuckets: UptimeBucket[] =
    buckets.length === totalBuckets
      ? buckets
      : Array.from({ length: totalBuckets }, (_, i) => {
          if (i < buckets.length) return buckets[i]
          return {
            start: "",
            end: "",
            status: "no_data" as BucketStatus,
            checks: 0,
            failed: 0,
          }
        })

  const incidentText =
    incidentCount === 0
      ? "no incidents"
      : incidentCount === 1
        ? "1 incident"
        : `${incidentCount} incidents`

  const formattedUptime =
    uptimePercent === 100 || Number.isInteger(uptimePercent)
      ? `${Math.round(uptimePercent)}%`
      : `${uptimePercent.toFixed(1)}%`

  const ariaLabel = `${projectName}: ${formattedUptime} uptime over the last 24 hours, ${incidentText}`

  // For responsive behavior: show last 30 buckets on <768px
  const cutoffIndex = totalBuckets - 30

  return (
    <TooltipProvider>
      <div
        role="img"
        aria-label={ariaLabel}
        className={`inline-flex items-center gap-[2px] ${className}`}
      >
        {normalizedBuckets.map((bucket, index) => {
          const color = STATUS_COLORS[bucket.status] || STATUS_COLORS.no_data
          const isOlderBucket = index < cutoffIndex
          const timeRange = formatRange(bucket.start, bucket.end)
          const statusLabel = STATUS_LABELS[bucket.status] || "Unknown"
          const checksDesc = getChecksDescription(bucket.checks, bucket.failed, bucket.status)

          return (
            <Tooltip
              key={bucket.start || index}
              side="top"
              content={
                <div className="py-1 px-1.5 text-xs text-left leading-tight">
                  <div className="font-semibold text-gray-900">{timeRange}</div>
                  <div className="text-gray-600">
                    Status: <span className="font-medium text-gray-900">{statusLabel}</span>
                  </div>
                  <div className="text-gray-500">{checksDesc}</div>
                </div>
              }
            >
              <span
                tabIndex={0}
                aria-label={`${timeRange}: ${statusLabel}, ${checksDesc}`}
                className={`w-[9px] h-[30px] rounded-[2px] transition-opacity hover:opacity-80 focus:outline-none focus:ring-1 focus:ring-gray-400 cursor-pointer ${
                  isOlderBucket ? "hidden md:inline-block" : "inline-block"
                }`}
                style={{ backgroundColor: color }}
              />
            </Tooltip>
          )
        })}
      </div>
    </TooltipProvider>
  )
}
