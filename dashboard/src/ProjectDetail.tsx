import { Chart, ChartPalette, TimeseriesChart } from "@cloudflare/kumo"
import { useEffect, useState } from "react"
import { getJson } from "./api"
import { AppShell } from "./components/AppShell"
import { Panel } from "./components/Panel"
import { StatRow } from "./components/StatRow"
import { StatusPill } from "./components/StatusPill"
import echarts from "./echarts"
import type { Project } from "./types"
import UptimeStrip from "./UptimeStrip"

type Check = { checked_at: string; status_code: number | null; response_time_ms: number | null }
type Metric = {
  period_start: string
  requests_count: number
  error_count: number
  p50_response_ms: number | null
  p99_response_ms: number | null
}

const STATUS_GROUPS = [
  { name: "2xx", color: ChartPalette.semantic("Success", true) },
  { name: "3xx", color: ChartPalette.semantic("Neutral", true) },
  { name: "4xx", color: ChartPalette.semantic("Warning", true) },
  { name: "5xx", color: ChartPalette.semantic("Attention", true) },
  { name: "No response", color: ChartPalette.semantic("Disabled", true) },
]

function classifyStatus(code: number | null): string {
  if (code == null) return "No response"
  if (code >= 500) return "5xx"
  if (code >= 400) return "4xx"
  if (code >= 300) return "3xx"
  if (code >= 200) return "2xx"
  return "No response"
}

function statusCodeSeries(checks: Check[]) {
  const hour = 3_600_000
  const end = Math.floor(Date.now() / hour) * hour
  const start = end - 23 * hour
  const buckets = Array.from({ length: 24 }, () => new Map<string, number>())
  for (const check of checks) {
    const index = Math.floor((Date.parse(check.checked_at) - start) / hour)
    if (index < 0 || index >= 24) continue
    const key = classifyStatus(check.status_code)
    buckets[index].set(key, (buckets[index].get(key) ?? 0) + 1)
  }
  return STATUS_GROUPS.map((group) => ({
    name: group.name,
    color: group.color,
    data: buckets.map((bucket, index) => [start + index * hour, bucket.get(group.name) ?? 0] as [number, number]),
  }))
}

const EMPTY_STATE_STYLE =
  "py-16 px-4 text-center border-2 border-dashed border-[var(--color-border)] rounded-md bg-[var(--color-panel)]"

function NoAnalytics({ text }: { text: string }) {
  return (
    <div className={EMPTY_STATE_STYLE}>
      <div className="text-base font-semibold text-[var(--color-text)]">No Cloudflare analytics yet.</div>
      <div className="mt-1 text-sm text-[var(--color-muted)]">{text}</div>
    </div>
  )
}

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

  const p50: [number, number][] = metrics
    .filter((m) => m.p50_response_ms != null)
    .map((m) => [Date.parse(m.period_start), m.p50_response_ms as number])

  const p99: [number, number][] = metrics
    .filter((m) => m.p99_response_ms != null)
    .map((m) => [Date.parse(m.period_start), m.p99_response_ms as number])

  const traffic: [number, number][] = metrics.map((m) => [Date.parse(m.period_start), m.requests_count])

  const statusSeries = statusCodeSeries(checks)

  const hasResponseData = responseTime.length > 0
  const hasErrorData = errorRate.length > 0
  const hasLatencyData = p50.length > 0 || p99.length > 0
  const hasTrafficData = traffic.length > 0
  const hasStatusData = checks.length > 0

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

        {/* Status code distribution */}
        <Panel className="p-4 sm:p-6">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-3">
            <h2 className="text-sm font-semibold text-[var(--color-text)]">Status codes · last 24h</h2>
            <p className="text-[10px] text-[var(--color-muted)]">
              {hasStatusData ? `${checks.length} checks` : "No checks yet"}
            </p>
          </div>
          {!hasStatusData ? (
            <div className={EMPTY_STATE_STYLE}>
              <div className="text-base font-semibold text-[var(--color-text)]">No checks yet</div>
              <div className="mt-1 text-sm text-[var(--color-muted)]">
                Status codes appear after the first check.
              </div>
            </div>
          ) : (
            <Chart
              echarts={echarts}
              isDarkMode
              height={280}
              options={{
                aria: {
                  enabled: true,
                  label: {
                    description: `Status code distribution for ${project.name} over the last 24 hours`,
                  },
                },
                grid: { left: 8, right: 8, top: 34, bottom: 8, containLabel: true },
                legend: { top: 0 },
                tooltip: { trigger: "axis", axisPointer: { type: "shadow" } },
                xAxis: { type: "time" },
                yAxis: { type: "value", minInterval: 1, name: "checks" },
                series: statusSeries.map((series) => ({
                  name: series.name,
                  type: "bar" as const,
                  stack: "total",
                  data: series.data,
                  itemStyle: { color: series.color },
                  barMaxWidth: 20,
                })),
              }}
            />
          )}
        </Panel>

        {/* Latency p50/p99 chart */}
        <Panel className="p-4 sm:p-6">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-3">
            <h2 className="text-sm font-semibold text-[var(--color-text)]">Latency p50 / p99 · last 7 days</h2>
            <p className="text-[10px] text-[var(--color-muted)]">
              {hasLatencyData ? `${p50.length} samples` : "No latency data yet"}
            </p>
          </div>
          {!hasLatencyData ? (
            <NoAnalytics text="Edge latency comes from zone HTTP analytics. Worker projects report request counts only." />
          ) : (
            <TimeseriesChart
              echarts={echarts}
              isDarkMode
              data={[
                { name: "p50 (ms)", data: p50, color: ChartPalette.categorical(0, true) },
                { name: "p99 (ms)", data: p99, color: ChartPalette.categorical(3, true) },
              ]}
              yAxisName="ms"
              tooltipValueFormat={(value) => `${Math.round(value)} ms`}
              ariaDescription={`p50 and p99 latency history for ${project.name} over the last 7 days, measured in milliseconds`}
            />
          )}
        </Panel>

        {/* Traffic chart */}
        <Panel className="p-4 sm:p-6">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-3">
            <h2 className="text-sm font-semibold text-[var(--color-text)]">Requests · last 7 days</h2>
            <p className="text-[10px] text-[var(--color-muted)]">
              {hasTrafficData ? `${traffic.length} samples` : "No traffic data yet"}
            </p>
          </div>
          {!hasTrafficData ? (
            <NoAnalytics text="Connect a token with Account Analytics → Read to see request volume." />
          ) : (
            <TimeseriesChart
              echarts={echarts}
              isDarkMode
              type="bar"
              data={[{ name: "Requests", data: traffic, color: ChartPalette.categorical(0, true) }]}
              yAxisName="requests"
              yAxisMinInterval={1}
              tooltipValueFormat={(value) => value.toLocaleString()}
              ariaDescription={`Request volume history for ${project.name} over the last 7 days`}
            />
          )}
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
            <NoAnalytics text="Connect a token with Account Analytics → Read to see error rates." />
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
