import { useCallback, useEffect, useState } from "react"
import { getJson } from "./api"
import type {
  Incident,
  OverviewDataState,
  OverviewSummary,
  Project,
  ProjectUptime,
  ProjectWithUptime,
} from "./types"

export function computeMedian(values: number[]): number | null {
  if (values.length === 0) return null
  const sorted = [...values].sort((a, b) => a - b)
  const mid = Math.floor(sorted.length / 2)
  if (sorted.length % 2 === 1) {
    return sorted[mid]
  }
  return Math.round((sorted[mid - 1] + sorted[mid]) / 2)
}

export function computeSummaryStats(
  projects: Project[],
  incidents: Incident[]
): OverviewSummary {
  const total = projects.length
  const up = projects.filter((p) => p.is_up).length

  const openIncidents = incidents.filter((i) => !i.resolved_at).length

  const responseTimes = projects
    .map((p) => p.response_time_ms)
    .filter((ms): ms is number => ms !== null && ms !== undefined)

  const medianResponseMs = computeMedian(responseTimes)

  return {
    operational: {
      up,
      total,
      formatted: `${up} / ${total}`,
    },
    openIncidents,
    medianResponseMs,
  }
}

const DEFAULT_SUMMARY: OverviewSummary = {
  operational: { up: 0, total: 0, formatted: "0 / 0" },
  openIncidents: 0,
  medianResponseMs: null,
}

export function useOverviewData(): OverviewDataState {
  const [projects, setProjects] = useState<ProjectWithUptime[]>([])
  const [summary, setSummary] = useState<OverviewSummary>(DEFAULT_SUMMARY)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchData = useCallback(async () => {
    try {
      const [projectsData, incidentsData, uptimeData] = await Promise.all([
        getJson<Project[]>("/api/projects"),
        getJson<Incident[]>("/api/incidents"),
        getJson<ProjectUptime[]>("/api/uptime?window=24h&buckets=60"),
      ])

      const uptimeMap = new Map<number, ProjectUptime>()
      for (const item of uptimeData) {
        uptimeMap.set(item.project_id, item)
      }

      const merged: ProjectWithUptime[] = projectsData.map((p) => ({
        ...p,
        uptime: uptimeMap.get(p.id),
      }))

      const computedSummary = computeSummaryStats(projectsData, incidentsData)

      setProjects(merged)
      setSummary(computedSummary)
      setError(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    let ignore = false
    const run = async () => {
      await Promise.resolve()
      if (!ignore) {
        void fetchData()
      }
    }
    void run()
    const intervalId = setInterval(() => {
      void fetchData()
    }, 30000)

    return () => {
      ignore = true
      clearInterval(intervalId)
    }
  }, [fetchData])

  return {
    projects,
    summary,
    loading,
    error,
    refetch: fetchData,
  }
}
