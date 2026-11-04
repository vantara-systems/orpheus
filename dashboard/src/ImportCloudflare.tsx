import { Button, Input, Table } from "@cloudflare/kumo"
import { useEffect, useState } from "react"
import { getJson } from "./api"
import { AppShell } from "./components/AppShell"
import { Panel } from "./components/Panel"
import { StatusPill } from "./components/StatusPill"

type Zone = { id: string; name: string; status: string }
type Worker = { account_id: string; account_name: string; name: string; url: string }
type Project = {
  id: number
  cloudflare_zone_id: string | null
  cloudflare_account_id: string | null
  cloudflare_worker_name: string | null
}
type Result = { key: string; label: string; url: string; ok: boolean; error?: string }

const workerKey = (worker: Worker) => `${worker.account_id}/${worker.name}`

const CHIP_STYLE =
  "inline-flex items-center gap-1 px-2 py-1 text-xs font-mono text-[#5b6573] bg-[#eef0f3] rounded-md border border-[#e6e9ee]"

const ERROR_BOX_STYLE =
  "rounded-md border border-[#e5a100] bg-[#fef9e7] p-3 mb-4 text-sm text-[#92400e]"

const EMPTY_STATE_STYLE =
  "py-16 px-4 text-center border-2 border-dashed border-[#e6e9ee] rounded-md bg-[#ffffff]"

export default function ImportCloudflare() {
  const [zones, setZones] = useState<Zone[]>([])
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [urls, setUrls] = useState<Record<string, string>>({})
  const [workers, setWorkers] = useState<Worker[]>([])
  const [selectedWorkers, setSelectedWorkers] = useState<Set<string>>(new Set())
  const [workerUrls, setWorkerUrls] = useState<Record<string, string>>({})
  const [loading, setLoading] = useState(true)
  const [importing, setImporting] = useState(false)
  const [importingWorkers, setImportingWorkers] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [workerError, setWorkerError] = useState<string | null>(null)
  const [results, setResults] = useState<Result[]>([])

  const load = async () => {
    setLoading(true)
    setError(null)
    setWorkerError(null)
    const [zonesRes, workersRes, projectsRes] = await Promise.allSettled([
      getJson<{ zones: Zone[] }>("/api/cloudflare/zones"),
      getJson<{ workers: Worker[] }>("/api/cloudflare/workers"),
      getJson<Project[]>("/api/projects"),
    ])

    if (projectsRes.status === "rejected") {
      const message = String(projectsRes.reason)
      setError(message)
      setWorkerError(message)
      setLoading(false)
      return
    }

    const projects = projectsRes.value
    if (zonesRes.status === "fulfilled") {
      const linked = new Set(
        projects.map((p) => p.cloudflare_zone_id).filter((id): id is string => !!id)
      )
      const available = zonesRes.value.zones.filter((zone) => !linked.has(zone.id))
      setZones(available)
      setSelected(new Set())
      setUrls(
        Object.fromEntries(available.map((zone) => [zone.id, `https://${zone.name}/`]))
      )
    } else {
      setZones([])
      setError(String(zonesRes.reason))
    }

    if (workersRes.status === "fulfilled") {
      const linked = new Set(
        projects
          .filter((p) => p.cloudflare_account_id && p.cloudflare_worker_name)
          .map((p) => `${p.cloudflare_account_id}/${p.cloudflare_worker_name}`)
      )
      const available = workersRes.value.workers.filter((worker) => !linked.has(workerKey(worker)))
      setWorkers(available)
      setSelectedWorkers(new Set())
      setWorkerUrls(
        Object.fromEntries(available.map((worker) => [workerKey(worker), worker.url]))
      )
    } else {
      setWorkers([])
      setWorkerError(String(workersRes.reason))
    }

    setLoading(false)
  }

  useEffect(() => {
    void load()
  }, [])

  const toggle = (id: string) =>
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })

  const toggleWorker = (key: string) =>
    setSelectedWorkers((prev) => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })

  const chosen = zones.filter((zone) => selected.has(zone.id))
  const chosenWorkers = workers.filter((worker) => selectedWorkers.has(workerKey(worker)))

  const runImport = async () => {
    setImporting(true)
    setResults([])
    const outcome: Result[] = []
    for (const zone of chosen) {
      const url = (urls[zone.id] || `https://${zone.name}/`).trim()
      try {
        const res = await fetch("/api/projects", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: zone.name,
            url,
            cloudflare_zone_id: zone.id,
            check_interval_seconds: 60,
            failure_threshold: 3,
            is_active: true,
          }),
        })
        if (!res.ok) throw new Error((await res.text()).trim() || `HTTP ${res.status}`)
        outcome.push({ key: `zone/${zone.id}`, label: zone.name, url, ok: true })
      } catch (e) {
        outcome.push({ key: `zone/${zone.id}`, label: zone.name, url, ok: false, error: String(e) })
      }
    }
    setResults(outcome)
    setImporting(false)
    void load()
  }

  const runImportWorkers = async () => {
    setImportingWorkers(true)
    setResults([])
    const outcome: Result[] = []
    for (const worker of chosenWorkers) {
      const key = workerKey(worker)
      const url = (workerUrls[key] || worker.url).trim()
      const label = `${worker.name} (${worker.account_name})`
      try {
        if (!url) throw new Error("URL is required")
        const res = await fetch("/api/projects", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: worker.name,
            url,
            cloudflare_account_id: worker.account_id,
            cloudflare_worker_name: worker.name,
            check_interval_seconds: 60,
            failure_threshold: 3,
            is_active: true,
          }),
        })
        if (!res.ok) throw new Error((await res.text()).trim() || `HTTP ${res.status}`)
        outcome.push({ key: `worker/${key}`, label, url, ok: true })
      } catch (e) {
        outcome.push({ key: `worker/${key}`, label, url, ok: false, error: String(e) })
      }
    }
    setResults(outcome)
    setImportingWorkers(false)
    void load()
  }

  return (
    <AppShell currentRoute="import">
      <div className="space-y-6">
        {/* Permissions info block */}
        <Panel className="py-4">
          <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
            <div>
              <h2 className="text-sm font-semibold text-[#111111] mb-2">
                Required Cloudflare API token permissions
              </h2>
              <p className="text-xs text-[#5b6573]">
                The token needs these permissions to import zones and Workers.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <span className={CHIP_STYLE}>Zone → Zone → Read</span>
              <span className={CHIP_STYLE}>Zone → Analytics → Read</span>
              <span className={CHIP_STYLE}>Account → Workers Scripts → Read</span>
              <span className={CHIP_STYLE}>Account Settings → Read</span>
              <span className={CHIP_STYLE}>Account Analytics → Read</span>
            </div>
          </div>
        </Panel>

        {error && (
          <div className={ERROR_BOX_STYLE}>
            <strong className="font-medium">Failed to load zones:</strong> {error}
            <div className="mt-1.5 text-xs text-[#92400e]">
              Make sure CLOUDFLARE_API_TOKEN is set and has permission Zone → Zone → Read
              and Zone → Analytics → Read.
            </div>
          </div>
        )}

        {loading && <div className="text-sm text-[#5b6573]">Loading zones and Workers…</div>}

        {/* Zones panel */}
        {!loading && !error && zones.length === 0 && (
          <div className={EMPTY_STATE_STYLE}>
            <div className="text-base font-semibold text-[#111111]">
              All zones are connected, or the account has no zones.
            </div>
          </div>
        )}

        {!loading && zones.length > 0 && (
          <>
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div className="flex items-center gap-2">
                <Button
                  variant="secondary"
                  onClick={() => setSelected(new Set(zones.map((z) => z.id)))}
                >
                  Select all
                </Button>
                <Button variant="secondary" onClick={() => setSelected(new Set())}>
                  Clear
                </Button>
              </div>
              <Button
                variant="primary"
                loading={importing}
                disabled={chosen.length === 0}
                onClick={runImport}
              >
                Import selected ({chosen.length})
              </Button>
            </div>

            <Panel>
              <Table>
                <Table.Header>
                  <Table.Row>
                    <Table.Head></Table.Head>
                    <Table.Head>Zone</Table.Head>
                    <Table.Head className="font-mono text-sm">Zone ID</Table.Head>
                    <Table.Head>URL health check</Table.Head>
                  </Table.Row>
                </Table.Header>
                <Table.Body>
                  {zones.map((zone) => (
                    <Table.Row key={zone.id}>
                      <Table.Cell>
                        <input
                          type="checkbox"
                          checked={selected.has(zone.id)}
                          onChange={() => toggle(zone.id)}
                          aria-label={`Select ${zone.name}`}
                        />
                      </Table.Cell>
                      <Table.Cell>
                        <div className="font-semibold text-[#111111]">{zone.name}</div>
                        <div className="text-xs text-[#5b6573]">
                          <StatusPill variant="neutral">Zone</StatusPill>
                        </div>
                      </Table.Cell>
                      <Table.Cell className="font-mono text-sm text-[#111111] tabular-nums">
                        {zone.id}
                      </Table.Cell>
                      <Table.Cell>
                        <Input
                          value={urls[zone.id] ?? ""}
                          onChange={(e) =>
                            setUrls((prev) => ({ ...prev, [zone.id]: e.target.value }))
                          }
                          aria-label={`URL for ${zone.name}`}
                          className="text-sm font-mono tabular-nums"
                        />
                        <div className="mt-1 text-[10px] text-[#5b6573]">
                          Checks start in ~10s
                        </div>
                      </Table.Cell>
                    </Table.Row>
                  ))}
                </Table.Body>
              </Table>
            </Panel>
          </>
        )}

        {/* Workers panel */}
        <h2 className="text-sm font-semibold text-[#111111] mt-8">Workers</h2>
        <p className="text-xs text-[#5b6573] mb-4" style={{ maxWidth: 720 }}>
          Token needs permission Account → Workers Scripts → Read, Account Settings → Read, and
          Account Analytics → Read. Analytics Worker data is stored as request/error count per
          hour; CPU time is not used because it is not response time.
        </p>

        {workerError && (
          <div className={ERROR_BOX_STYLE}>
            <strong className="font-medium">Failed to load Workers:</strong> {workerError}
          </div>
        )}

        {!loading && !workerError && workers.length === 0 && (
          <div className={EMPTY_STATE_STYLE}>
            <div className="text-base font-semibold text-[#111111]">
              All Workers are connected, or the account has no Workers.
            </div>
          </div>
        )}

        {!loading && workers.length > 0 && (
          <>
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div className="flex items-center gap-2">
                <Button
                  variant="secondary"
                  onClick={() => setSelectedWorkers(new Set(workers.map(workerKey)))}
                >
                  Select all
                </Button>
                <Button variant="secondary" onClick={() => setSelectedWorkers(new Set())}>
                  Clear
                </Button>
              </div>
              <Button
                variant="primary"
                loading={importingWorkers}
                disabled={chosenWorkers.length === 0}
                onClick={runImportWorkers}
              >
                Import selected ({chosenWorkers.length})
              </Button>
            </div>

            <Panel>
              <Table>
                <Table.Header>
                  <Table.Row>
                    <Table.Head></Table.Head>
                    <Table.Head>Worker</Table.Head>
                    <Table.Head>Account</Table.Head>
                    <Table.Head>URL health check</Table.Head>
                  </Table.Row>
                </Table.Header>
                <Table.Body>
                  {workers.map((worker) => {
                    const key = workerKey(worker)
                    return (
                      <Table.Row key={key}>
                        <Table.Cell>
                          <input
                            type="checkbox"
                            checked={selectedWorkers.has(key)}
                            onChange={() => toggleWorker(key)}
                            aria-label={`Select ${worker.name}`}
                          />
                        </Table.Cell>
                        <Table.Cell>
                          <div className="font-semibold text-[#111111]">{worker.name}</div>
                          <div className="text-xs text-[#5b6573]">
                            <StatusPill variant="neutral">Worker</StatusPill>
                          </div>
                        </Table.Cell>
                        <Table.Cell>{worker.account_name}</Table.Cell>
                        <Table.Cell>
                          <Input
                            value={workerUrls[key] ?? ""}
                            onChange={(e) =>
                              setWorkerUrls((prev) => ({ ...prev, [key]: e.target.value }))
                            }
                            aria-label={`URL for ${worker.name}`}
                            placeholder="https://name.account.workers.dev/"
                            className="text-sm font-mono tabular-nums"
                          />
                          <div className="mt-1 text-[10px] text-[#5b6573]">
                            Checks start in ~10s
                          </div>
                        </Table.Cell>
                      </Table.Row>
                    )
                  })}
                </Table.Body>
              </Table>
            </Panel>
          </>
        )}

        {results.length > 0 && (
          <Panel className="pt-4 pb-4">
            <h2 className="text-sm font-semibold text-[#111111] mb-3">Import results</h2>
            <ul className="space-y-1 text-sm">
              {results.map((result) => (
                <li key={result.key} className="flex items-start gap-2">
                  <span
                    className={`font-medium ${result.ok ? "text-[#0d6b43]" : "text-[#b42318]"}`}
                  >
                    {result.ok ? "OK" : "Failed"}
                  </span>
                  <span className="text-[#5b6573]">—</span>
                  <span className="font-semibold text-[#111111]">{result.label}</span>
                  <span className="text-[#5b6573]">({result.url})</span>
                  {result.error && (
                    <span className="text-[#b42318] ml-1">: {result.error}</span>
                  )}
                </li>
              ))}
            </ul>
          </Panel>
        )}
      </div>
    </AppShell>
  )
}
