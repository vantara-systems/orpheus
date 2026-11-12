import AppShell from "./components/AppShell"
import Panel from "./components/Panel"
import StatRow from "./components/StatRow"
import { SkeletonRow } from "./components/SkeletonRow"
import type { ProjectWithUptime } from "./types"
import UptimeStrip from "./UptimeStrip"
import { useOverviewData } from "./useOverviewData"

export default function Overview() {
  const { projects, summary, loading, error, refetch } = useOverviewData()

  return (
    <AppShell currentRoute="overview">
      {error && (
        <div className="mb-6 rounded-[10px] border border-[var(--color-error-border)] bg-[var(--color-error-bg)] p-4 flex items-center justify-between">
          <div className="text-sm text-[var(--color-error-text)]">
            <span className="font-semibold">Failed to load overview data:</span> {error}
          </div>
          <button
            type="button"
            onClick={() => void refetch()}
            className="px-3 py-1.5 text-xs font-medium rounded-md bg-[var(--color-panel)] border border-[var(--color-error-border)] text-[var(--color-error-text)] hover:bg-[var(--color-error-bg)] focus:outline-none focus:ring-2 focus:ring-[var(--color-error-border)] cursor-pointer"
          >
            Retry
          </button>
        </div>
      )}

      {/* White Panel Container */}
      <Panel>
        {/* Summary Row */}
        <StatRow
          stats={[
            {
              label: "Operational",
              value: summary.operational.formatted,
              loading,
            },
            {
              label: "Open incidents",
              value: summary.openIncidents,
              loading,
            },
            {
              label: "Median response",
              value: summary.medianResponseMs !== null ? `${summary.medianResponseMs} ms` : "—",
              loading,
            },
          ]}
        />

        {/* Project Rows or Loading / Empty States */}
        <div className="border-t border-[var(--color-border)]">
          {loading ? (
            <SkeletonRow count={3} />
          ) : projects.length === 0 ? (
            <div className="py-16 px-4 text-center">
              <div className="text-base font-semibold text-[var(--color-text)]">No projects yet</div>
              <p className="mt-1 text-sm text-[var(--color-muted)]">
                Start monitoring services by importing them from Cloudflare.
              </p>
              <div className="mt-5">
                <a
                  href="#/import"
                  className="inline-flex items-center justify-center px-4 py-2 text-sm font-medium text-[var(--color-panel)] bg-[var(--color-text)] hover:opacity-90 rounded-md shadow-xs focus:outline-none focus:ring-2 focus:ring-[var(--color-muted)] transition-opacity"
                >
                  Import Cloudflare
                </a>
              </div>
            </div>
          ) : (
            <div className="divide-y divide-[var(--color-border)]">
              {projects.map((project) => (
                <ProjectRow key={project.id} project={project} />
              ))}
            </div>
          )}
        </div>

        {/* Footer Line: Legend */}
        <div className="border-t border-[var(--color-border)] bg-[var(--color-hover)] px-5 py-3 text-xs text-[var(--color-muted)] flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>Each bar is a 24 min window · grey = no data</div>
          <div className="flex items-center gap-4">
            <span className="inline-flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-[var(--color-chart-up)]" />
              Up
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-[var(--color-warning)]" />
              Degraded
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-[var(--color-chart-down)]" />
              Down
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-[var(--color-chart-nodata)]" />
              No data
            </span>
          </div>
        </div>
      </Panel>
    </AppShell>
  )
}

function ProjectRow({ project }: { project: ProjectWithUptime }) {
  const uptimePct = project.uptime?.uptime_percent ?? project.uptime_24h_percent ?? 100
  const isPerfect = uptimePct === 100

  const uptimeText =
    isPerfect || Number.isInteger(uptimePct) ? `${Math.round(uptimePct)}%` : `${uptimePct.toFixed(1)}%`

  const responseText =
    project.response_time_ms !== null && project.response_time_ms !== undefined
      ? `${project.response_time_ms} ms`
      : "—"

  return (
    <div className="p-4 sm:p-5 flex flex-col md:flex-row md:items-center justify-between gap-3 md:gap-4 hover:bg-[var(--color-hover)] transition-colors">
      {/* Project name & response time */}
      <div className="w-full md:w-48 shrink-0 flex items-center justify-between md:block">
        <div>
          <a
            href={`#/projects/${project.id}`}
            className="font-semibold text-sm sm:text-base text-[var(--color-text)] hover:underline focus:outline-none focus:ring-1 focus:ring-[var(--color-muted)] rounded"
          >
            {project.name}
          </a>
          <div className="text-xs text-[var(--color-muted)] mt-0.5">{responseText}</div>
        </div>

        {/* On mobile (<768px), display uptime % on the header row as well */}
        <div
          className="md:hidden font-semibold text-sm tabular-nums"
          style={{ color: isPerfect ? "var(--color-status-text-up)" : "var(--color-status-text-down)" }}
        >
          {uptimeText}
        </div>
      </div>

      {/* Uptime Strip in the middle */}
      <div className="flex-1 flex items-center justify-start md:justify-center overflow-x-auto py-1">
        <UptimeStrip
          projectName={project.name}
          uptimePercent={uptimePct}
          buckets={project.uptime?.buckets}
        />
      </div>

      {/* Uptime % text right-aligned (desktop) */}
      <div
        className="hidden md:block w-20 text-right shrink-0 font-semibold text-sm sm:text-base tabular-nums"
        style={{ color: isPerfect ? "var(--color-status-text-up)" : "var(--color-status-text-down)" }}
      >
        {uptimeText}
      </div>
    </div>
  )
}
