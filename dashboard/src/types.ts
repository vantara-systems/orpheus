export type BucketStatus = "up" | "degraded" | "down" | "no_data"

export interface UptimeBucket {
  start: string
  end: string
  status: BucketStatus
  checks: number
  failed: number
}

export interface ProjectUptime {
  project_id: number
  uptime_percent: number
  buckets: UptimeBucket[]
}

export interface Project {
  id: number
  name: string
  url: string
  cloudflare_zone_id?: string | null
  cloudflare_account_id?: string | null
  cloudflare_worker_name?: string | null
  is_up: boolean
  last_checked_at: string | null
  response_time_ms: number | null
  uptime_24h_percent: number
}

export interface Incident {
  id: number
  project_id: number
  type: string
  started_at: string
  resolved_at: string | null
  description: string | null
}

export interface ProjectWithUptime extends Project {
  uptime?: ProjectUptime
}

export interface OverviewSummary {
  operational: {
    up: number
    total: number
    formatted: string
  }
  openIncidents: number
  medianResponseMs: number | null
}

export interface OverviewDataState {
  projects: ProjectWithUptime[]
  summary: OverviewSummary
  loading: boolean
  error: string | null
  refetch: () => Promise<void>
}
