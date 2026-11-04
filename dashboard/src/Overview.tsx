import AppShell from "./components/AppShell"
import Panel from "./components/Panel"
import StatRow from "./components/StatRow"
import type { ProjectWithUptime } from "./types"
import UptimeStrip from "./UptimeStrip"
import { useOverviewData } from "./useOverviewData"

export default function Overview() {
  const { projects, summary, loading, error, refetch } = useOverviewData()

  return (
    <AppShell currentRoute="overview">
      {error && (
        <div className="mb-6 rounded-[10px] border border-red-200 bg-red-50 p-4 flex items-center justify-between">
          <div className="text-sm text-red-800">
            <span className="font-semibold">Failed to load overview data:</span> {error}
          </div>
          <button
            type="button"
            onClick={() => void refetch()}
            className="px-3 py-1.5 text-xs font-medium rounded-md bg-white border border-red-300 text-red-700 hover:bg-red-50 focus:outline-none focus:ring-2 focus:ring-red-500 cursor-pointer"
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
        <div className="border-t border-[#e6e9ee]">
          {loading ? (
            <div className="divide-y divide-[#e6e9ee]">
              {[1, 2, 3].map((i) => (
                <div
                  key={i}
                  className="p-5 sm:p-6 flex flex-col md:flex-row md:items-center justify-between gap-4"
                >
                  <div className="w-44 space-y-2">
                    <div className="h-5 bg-gray-200 animate-pulse rounded w-32" />
                    <div className="h-4 bg-gray-100 animate-pulse rounded w-20" />
                  </div>
                  <div className="h-8 bg-gray-100 animate-pulse rounded w-full max-w-xl" />
                  <div className="h-5 bg-gray-200 animate-pulse rounded w-16" />
                </div>
              ))}
            </div>
          ) : projects.length === 0 ? (
            <div className="py-16 px-4 text-center">
              <div className="text-base font-semibold text-[#111111]">No projects yet</div>
              <p className="mt-1 text-sm text-[#5b6573]">
                Start monitoring services by importing them from Cloudflare.
              </p>
              <div className="mt-5">
                <a
                  href="#/import"
                  className="inline-flex items-center justify-center px-4 py-2 text-sm font-medium text-white bg-[#111111] hover:bg-gray-800 rounded-md shadow-xs focus:outline-none focus:ring-2 focus:ring-gray-900 transition-colors"
                >
                  Import Cloudflare
                </a>
              </div>
            </div>
          ) : (
            <div className="divide-y divide-[#e6e9ee]">
              {projects.map((project) => (
                <ProjectRow key={project.id} project={project} />
              ))}
            </div>
          )}
        </div>

        {/* Footer Line: Legend */}
        <div className="border-t border-[#e6e9ee] bg-[#fafbfc] px-5 py-3 text-xs text-[#5b6573] flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>Each bar is a 24 min window · grey = no data</div>
          <div className="flex items-center gap-4">
            <span className="inline-flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-[#1a9b5f]" />
              Up
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-[#e5a100]" />
              Degraded
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-[#d1382c]" />
              Down
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-[#d9e0e7]" />
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
    <div className="p-4 sm:p-5 flex flex-col md:flex-row md:items-center justify-between gap-3 md:gap-4 hover:bg-[#fafbfc] transition-colors">
      {/* Project name & response time */}
      <div className="w-full md:w-48 shrink-0 flex items-center justify-between md:block">
        <div>
          <a
            href={`#/projects/${project.id}`}
            className="font-semibold text-sm sm:text-base text-[#111111] hover:underline focus:outline-none focus:ring-1 focus:ring-gray-400 rounded"
          >
            {project.name}
          </a>
          <div className="text-xs text-[#5b6573] mt-0.5">{responseText}</div>
        </div>

        {/* On mobile (<768px), display uptime % on the header row as well */}
        <div
          className="md:hidden font-semibold text-sm tabular-nums"
          style={{ color: isPerfect ? "#0d6b43" : "#b42318" }}
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
        style={{ color: isPerfect ? "#0d6b43" : "#b42318" }}
      >
        {uptimeText}
      </div>
    </div>
  )
}
