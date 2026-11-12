import { ChartPalette, TimeseriesChart } from "@cloudflare/kumo"
import { useEffect, useState } from "react"
import { getJson } from "./api"
import { AppShell } from "./components/AppShell"
import { Panel } from "./components/Panel"
import { StatRow } from "./components/StatRow"
import { StatusPill } from "./components/StatusPill"
import echarts from "./echarts"
import type { Project } from "./types"
import UptimeStrip from "./UptimeStrip"

type Check = { checked_at: string; response_time_ms: number | null }
type Metric = { period_start: string; requests_count: number; error_count: number }

const EMPTY_STATE_STYLE =
  "py-16 px-4 text-center border-2 border-dashed border-[var(--color-border)] rounded-md bg-[var(--color-panel)]"

export default function ProjectDetail({ projectId }: { projectId: number }) {
  const [project, setProject] = useState<Project | null>(null)
  const [checks, setChecks] = useState<Check[]>([])
  const [metrics, setMetrics] = useState<Metric[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let alive = true
    Promise.all([
      getJson<Project[]>("/api/projects"),
      getJson<Check[]>(`/api/projects/${projectId}/checks?range=24h`),
      getJson<Metric[]>(`/api/projects/${projectId}/metrics?range=7d`),
    ])
      .then(([projects, c, m]) => {
        if (!alive) return
        setProject(projects.find((p) => p.id === projectId) ?? null)
        setChecks(c)
        setMetrics(m)
        setLoading(false)
      })
      .catch((e) => alive && setError(String(e)))
    return () => {
      alive = false
    }
  }, [projectId])

  if (error) {
    return (
      <AppShell currentRoute="detail">
        <div className="rounded-md border border-[var(--color-warning)] bg-[var(--color-warning-bg)] p-3 text-sm text-[var(--color-warning-text)]">
          Failed to load project: {error}
        </div>
      </AppShell>
    )
  }

  if (loading) {
    return (
      <AppShell currentRoute="detail">
        <div className="flex items-center gap-2 text-sm text-[var(--color-muted)]">
          <div className="h-4 w-20 bg-[var(--color-border)] animate-pulse rounded" />
          <span>Loading project…</span>
        </div>
      </AppShell>
    )
  }

  if (!project) {
    return (
      <AppShell currentRoute="detail">
        <div className={EMPTY_STATE_STYLE}>
          <div className="text-base font-semibold text-[var(--color-text)]">Project not found</div>
        </div>
      </AppShell>
    )
  }

  const responseTime: [number, number][] = checks
    .filter((c) => c.response_time_ms != null)
    .map((c) => [Date.parse(c.checked_at), c.response_time_ms as number])

  const errorRate: [number, number][] = metrics
    .filter((m) => m.requests_count > 0)
    .map((m) => [Date.parse(m.period_start), Math.round((m.error_count / m.requests_count) * 10000) / 100])

  const hasResponseData = responseTime.length > 0
  const hasErrorData = errorRate.length > 0

  const uptimePct = project.uptime_24h_percent ?? 100
  const uptimeText = uptimePct === 100 || Number.isInteger(uptimePct) ? `${Math.round(uptimePct)}%` : `${uptimePct.toFixed(1)}%`
  const responseText = project.response_time_ms !== null ? `${project.response_time_ms} ms` : "—"

  return (
    <AppShell currentRoute="detail" breadcrumbLabel={project.name}>
      <div className="space-y-6">
        {/* Header panel */}
        <Panel className="p-4 sm:p-6">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <h1 className="text-base font-semibold text-[var(--color-text)]">{project.name}</h1>
              <div className="mt-1 text-xs font-mono tabular-nums text-[var(--color-muted)]">{project.url}</div>
            </div>
            <StatusPill variant={project.is_up ? "up" : "down"}>
              {project.is_up ? "Up" : "Down"}
            </StatusPill>
          </div>
        </Panel>

        {/* Summary stats */}
        <Panel>
          <StatRow
            stats={[
              { label: "Uptime 24h", value: uptimeText, loading: false },
              { label: "Response", value: responseText, loading: false },
              { label: "Last check", value: "-", loading: false },
            ]}
          />
        </Panel>

        {/* Uptime strip */}
        <Panel className="px-5 py-4 sm:px-6">
          <UptimeStrip projectName={project.name} uptimePercent={uptimePct} />
        </Panel>

        {/* Response time chart */}
        <Panel className="p-4 sm:p-6">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-3">
            <h2 className="text-sm font-semibold text-[var(--color-text)]">Response time · last 24h</h2>
            <p className="text-[10px] text-[var(--color-muted)]">
              {hasResponseData
                ? `${responseTime.length} response time samples`
                : "No response time data yet"}
            </p>
          </div>
          <TimeseriesChart
            echarts={echarts}
            isDarkMode
            loading={!hasResponseData}
            data={[
              {
                name: "Response time (ms)",
                data: responseTime,
                color: "#e7e9ee",
              },
            ]}
            yAxisName="ms"
            ariaDescription={
              hasResponseData
                ? `Response time history for ${project.name} over the last 24 hours, measured in milliseconds`
                : `No response time data available for ${project.name} over the last 24 hours`
            }
          />
        </Panel>

        {/* Error rate chart */}
        <Panel className="p-4 sm:p-6">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-3">
            <h2 className="text-sm font-semibold text-[var(--color-text)]">Error rate · last 7 days</h2>
            <p className="text-[10px] text-[var(--color-muted)]">
              {hasErrorData ? `${errorRate.length} samples` : "No data"}
            </p>
          </div>
          {!hasErrorData ? (
            <div className="py-16 px-4 text-center border-2 border-dashed border-[var(--color-border)] rounded-md bg-[var(--color-panel)]">
              <div className="text-base font-semibold text-[var(--color-text)]">
                No Cloudflare analytics yet.
              </div>
              <div className="mt-1 text-sm text-[var(--color-muted)]">
                Connect a token with Account Analytics → Read to see error rates.
              </div>
            </div>
          ) : (
            <TimeseriesChart
              echarts={echarts}
              isDarkMode
              data={[
                {
                  name: "Error rate (%)",
                  data: errorRate,
                  color: ChartPalette.categorical(1, true),
                },
              ]}
              yAxisName="%"
              ariaDescription={`Error rate history for ${project.name} over the last 7 days, measured in percent`}
            />
          )}
        </Panel>
      </div>
    </AppShell>
  )
}
