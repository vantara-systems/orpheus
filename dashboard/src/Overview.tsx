import type { ProjectWithUptime } from "./types"
import UptimeStrip from "./UptimeStrip"
import { useOverviewData } from "./useOverviewData"

export default function Overview() {
  const { projects, summary, loading, error, refetch } = useOverviewData()

  return (
    <div className="min-h-screen bg-[#f7f8fa] text-[#111111] font-sans antialiased">
      {/* Header */}
      <header className="border-b border-[#e6e9ee] bg-[#ffffff]">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <a
              href="#/"
              className="text-lg font-semibold tracking-tight text-[#111111] hover:opacity-80 transition-opacity"
            >
              Orpheus
            </a>
          </div>
          <nav className="flex items-center gap-6" aria-label="Main Navigation">
            <a
              href="#/"
              className="text-sm font-medium text-[#111111] border-b-2 border-[#111111] py-4 transition-colors"
            >
              Overview
            </a>
            <a
              href="#/incidents"
              className="text-sm font-medium text-[#5b6573] hover:text-[#111111] py-4 transition-colors focus:outline-none focus:ring-1 focus:ring-gray-400 rounded"
            >
              Incidents
            </a>
            <a
              href="#/import"
              className="text-sm font-medium text-[#5b6573] hover:text-[#111111] py-4 transition-colors focus:outline-none focus:ring-1 focus:ring-gray-400 rounded"
            >
              Import Cloudflare
            </a>
          </nav>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-6xl mx-auto px-4 sm:px-6 py-8">
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
        <div className="bg-[#ffffff] border border-[#e6e9ee] rounded-[10px] shadow-xs overflow-hidden">
          {/* Summary Row */}
          <div className="grid grid-cols-1 md:grid-cols-3 divide-y md:divide-y-0 md:divide-x divide-[#e6e9ee]">
            {/* Operational */}
            <div className="p-5 sm:p-6">
              <div className="text-xs font-medium text-[#5b6573]">Operational</div>
              {loading ? (
                <div className="mt-2 h-7 w-20 bg-gray-200 animate-pulse rounded" />
              ) : (
                <div className="mt-1 text-2xl font-semibold tracking-tight text-[#111111] tabular-nums">
                  {summary.operational.formatted}
                </div>
              )}
            </div>

            {/* Open Incidents */}
            <div className="p-5 sm:p-6">
              <div className="text-xs font-medium text-[#5b6573]">Open incidents</div>
              {loading ? (
                <div className="mt-2 h-7 w-12 bg-gray-200 animate-pulse rounded" />
              ) : (
                <div className="mt-1 text-2xl font-semibold tracking-tight text-[#111111] tabular-nums">
                  {summary.openIncidents}
                </div>
              )}
            </div>

            {/* Median Response */}
            <div className="p-5 sm:p-6">
              <div className="text-xs font-medium text-[#5b6573]">Median response</div>
              {loading ? (
                <div className="mt-2 h-7 w-24 bg-gray-200 animate-pulse rounded" />
              ) : (
                <div className="mt-1 text-2xl font-semibold tracking-tight text-[#111111] tabular-nums">
                  {summary.medianResponseMs !== null ? `${summary.medianResponseMs} ms` : "—"}
                </div>
              )}
            </div>
          </div>

          {/* Project Rows or Loading / Empty States */}
          <div className="border-t border-[#e6e9ee]">
            {loading ? (
              <div className="divide-y divide-[#e6e9ee]">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="p-5 sm:p-6 flex flex-col md:flex-row md:items-center justify-between gap-4">
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
        </div>
      </main>
    </div>
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
