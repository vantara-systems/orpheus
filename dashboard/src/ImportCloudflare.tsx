import { Button, Table } from "@cloudflare/kumo"
import { useEffect, useState } from "react"
import { getJson } from "./api"

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
      setUrls(Object.fromEntries(available.map((zone) => [zone.id, `https://${zone.name}/`])))
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
      setWorkerUrls(Object.fromEntries(available.map((worker) => [workerKey(worker), worker.url])))
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
        if (!url) throw new Error("URL wajib diisi")
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
    <div style={{ padding: 24 }}>
      <a href="#/">← Overview</a>
      <h1>Import dari Cloudflare</h1>
      <p style={{ maxWidth: 720 }}>
        Zone dan Worker yang sudah terhubung tidak ditampilkan. URL diisi otomatis—ubah jika
        project berada di subdomain atau domain kustom. Project mulai dicek otomatis dalam ±10
        detik.
      </p>

      {error && (
        <div style={{ marginTop: 16, padding: 12, background: "#fff1f0", border: "1px solid #ffa39e" }}>
          <strong>Gagal memuat zone:</strong> {error}
          <div style={{ marginTop: 4 }}>
            Pastikan <code>CLOUDFLARE_API_TOKEN</code> diset dan token punya permission Zone → Zone →
            Read serta Zone → Analytics → Read.
          </div>
        </div>
      )}

      {loading && <div>Memuat zone dan Worker…</div>}

      {!loading && !error && zones.length === 0 && (
        <div>Semua zone Cloudflare sudah terhubung, atau akun tidak punya zone.</div>
      )}

      {!loading && zones.length > 0 && (
        <>
          <div style={{ display: "flex", gap: 12, margin: "16px 0" }}>
            <Button
              variant="secondary"
              onClick={() => setSelected(new Set(zones.map((zone) => zone.id)))}
            >
              Pilih semua
            </Button>
            <Button variant="secondary" onClick={() => setSelected(new Set())}>
              Kosongkan
            </Button>
            <Button
              variant="primary"
              loading={importing}
              disabled={chosen.length === 0}
              onClick={runImport}
            >
              Import {chosen.length} zone
            </Button>
          </div>

          <Table>
            <Table.Header>
              <Table.Row>
                <Table.Head></Table.Head>
                <Table.Head>Zone</Table.Head>
                <Table.Head>Zone ID</Table.Head>
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
                      aria-label={`Pilih ${zone.name}`}
                    />
                  </Table.Cell>
                  <Table.Cell>{zone.name}</Table.Cell>
                  <Table.Cell>
                    <code>{zone.id}</code>
                  </Table.Cell>
                  <Table.Cell>
                    <input
                      value={urls[zone.id] ?? ""}
                      onChange={(e) =>
                        setUrls((prev) => ({ ...prev, [zone.id]: e.target.value }))
                      }
                      style={{ width: "100%", padding: 6 }}
                      aria-label={`URL untuk ${zone.name}`}
                    />
                  </Table.Cell>
                </Table.Row>
              ))}
            </Table.Body>
          </Table>
        </>
      )}

      <h2 style={{ marginTop: 32 }}>Workers</h2>
      <p style={{ maxWidth: 720 }}>
        Token perlu permission Account → Workers Scripts → Read, Account Settings → Read, dan
        Account Analytics → Read. Analytics Worker disimpan sebagai request/error count per jam;
        CPU time tidak dipakai karena bukan response time.
      </p>

      {workerError && (
        <div style={{ marginTop: 16, padding: 12, background: "#fff1f0", border: "1px solid #ffa39e" }}>
          <strong>Gagal memuat Worker:</strong> {workerError}
        </div>
      )}

      {!loading && !workerError && workers.length === 0 && (
        <div>Semua Worker sudah terhubung, atau akun tidak punya Worker.</div>
      )}

      {!loading && workers.length > 0 && (
        <>
          <div style={{ display: "flex", gap: 12, margin: "16px 0" }}>
            <Button
              variant="secondary"
              onClick={() => setSelectedWorkers(new Set(workers.map(workerKey)))}
            >
              Pilih semua
            </Button>
            <Button variant="secondary" onClick={() => setSelectedWorkers(new Set())}>
              Kosongkan
            </Button>
            <Button
              variant="primary"
              loading={importingWorkers}
              disabled={chosenWorkers.length === 0}
              onClick={runImportWorkers}
            >
              Import {chosenWorkers.length} Worker
            </Button>
          </div>

          <Table>
            <Table.Header>
              <Table.Row>
                <Table.Head></Table.Head>
                <Table.Head>Worker</Table.Head>
                <Table.Head>Akun</Table.Head>
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
                        aria-label={`Pilih ${worker.name}`}
                      />
                    </Table.Cell>
                    <Table.Cell>{worker.name}</Table.Cell>
                    <Table.Cell>{worker.account_name}</Table.Cell>
                    <Table.Cell>
                      <input
                        value={workerUrls[key] ?? ""}
                        placeholder="https://nama.akun.workers.dev/"
                        onChange={(e) =>
                          setWorkerUrls((prev) => ({ ...prev, [key]: e.target.value }))
                        }
                        style={{ width: "100%", padding: 6 }}
                        aria-label={`URL untuk ${worker.name}`}
                      />
                    </Table.Cell>
                  </Table.Row>
                )
              })}
            </Table.Body>
          </Table>
        </>
      )}

      {results.length > 0 && (
        <div style={{ marginTop: 16 }}>
          <h2>Hasil import</h2>
          <ul>
            {results.map((result) => (
              <li key={result.key}>
                {result.ok ? "OK" : "Gagal"} — {result.label} ({result.url})
                {result.error ? `: ${result.error}` : ""}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}
