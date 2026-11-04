import { Table } from "@cloudflare/kumo"
import { useEffect, useState } from "react"
import { getJson } from "./api"
import { AppShell } from "./components/AppShell"
import { Panel } from "./components/Panel"
import { SkeletonRow } from "./components/SkeletonRow"
import { StatRow } from "./components/StatRow"
import { StatusPill } from "./components/StatusPill"

type Incident = {
  id: number
  project_id: number
  project_name: string | null
  type: string
  started_at: string
  resolved_at: string | null
  description: string | null
}

type IncidentsStats = {
  openCount: number
  resolved7d: number
  longestOpen: string | null
}

function formatDuration(start: string, end: string | null) {
  const s = Date.parse(start)
  const e = end ? Date.parse(end) : Date.now()
  const ms = e - s
  const m = Math.floor(ms / 60000)
  if (m < 60) return `${m}m`
  const h = Math.floor(m / 60)
  const rm = m % 60
  return `${h}h ${rm}m`
}

function formatStarted(iso: string) {
  return new Date(iso).toLocaleString()
}

function longestOpenDuration(incidents: Incident[]): string | null {
  const open = incidents.filter((i) => !i.resolved_at)
  if (open.length === 0) return null
  let longest = open[0]
  let max = Date.now() - Date.parse(longest.started_at)
  for (const i of open) {
    const d = Date.now() - Date.parse(i.started_at)
    if (d > max) {
      max = d
      longest = i
    }
  }
  return formatDuration(longest.started_at, null)
}

function computeStats(incidents: Incident[]): IncidentsStats {
  const sevenDays = 7 * 24 * 60 * 60 * 1000
  const openCount = incidents.filter((i) => !i.resolved_at).length
  const resolved7d = incidents.filter(
    (i) => i.resolved_at && Date.now() - Date.parse(i.resolved_at) <= sevenDays
  ).length
  return { openCount, resolved7d, longestOpen: longestOpenDuration(incidents) }
}

export default function Incidents() {
  const [incidents, setIncidents] = useState<Incident[]>([])
  const [stats, setStats] = useState<IncidentsStats>({
    openCount: 0,
    resolved7d: 0,
    longestOpen: null,
  })
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    setLoading(true)
    setError(null)
    getJson<Incident[]>("/api/incidents")
      .then((data) => {
        setIncidents(data)
        setStats(computeStats(data))
        setLoading(false)
      })
      .catch((e) => {
        setError(String(e))
        setLoading(false)
      })
  }, [])

  if (error) {
    return (
      <AppShell currentRoute="incidents">
        <div style={{ padding: 24 }}>
          <a href="#/">← Overview</a>
          <div className="rounded-[10px] border border-[#ffa39e] bg-[#fff1f0] p-4 text-sm text-[#b42318]">
            Failed to load incidents: {error}
          </div>
        </div>
      </AppShell>
    )
  }

  return (
    <AppShell currentRoute="incidents">
      <Panel>
        <StatRow
          stats={[
            { label: "Open", value: stats.openCount, loading },
            { label: "Resolved 7d", value: stats.resolved7d, loading },
            { label: "Longest open", value: stats.longestOpen ?? "—", loading },
          ]}
        />

        <div className="border-t border-[#e6e9ee]">
          {loading ? (
            <SkeletonRow count={3} />
          ) : incidents.length === 0 ? (
            <div className="py-16 px-4 text-center">
              <div className="text-base font-semibold text-[#111111]">No incidents</div>
              <p className="mt-1 text-sm text-[#5b6573]">
                There are no open or resolved incidents to display.
              </p>
            </div>
          ) : (
            <Table>
              <Table.Header>
                <Table.Row>
                  <Table.Head>Project</Table.Head>
                  <Table.Head>Type</Table.Head>
                  <Table.Head>Started</Table.Head>
                  <Table.Head>Duration</Table.Head>
                  <Table.Head>Status</Table.Head>
                </Table.Row>
              </Table.Header>
              <Table.Body>
                {incidents.map((inc) => (
                  <Table.Row key={inc.id}>
                    <Table.Cell>
                      <span className="font-semibold text-[#111111]">
                        {inc.project_name ?? "Unknown project"}
                      </span>
                    </Table.Cell>
                    <Table.Cell>
                      <StatusPill variant="neutral">{inc.type}</StatusPill>
                    </Table.Cell>
                    <Table.Cell className="font-mono text-sm text-[#5b6573]">
                      {formatStarted(inc.started_at)}
                    </Table.Cell>
                    <Table.Cell className="font-mono text-sm text-[#111111] tabular-nums">
                      {formatDuration(inc.started_at, inc.resolved_at)}
                    </Table.Cell>
                    <Table.Cell>
                      {inc.resolved_at ? (
                        <StatusPill variant="up">Resolved</StatusPill>
                      ) : (
                        <StatusPill variant="down">Open</StatusPill>
                      )}
                    </Table.Cell>
                  </Table.Row>
                ))}
              </Table.Body>
            </Table>
          )}
        </div>
      </Panel>
    </AppShell>
  )
}
