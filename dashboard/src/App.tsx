import { useEffect, useState } from "react"
import ImportCloudflare from "./ImportCloudflare"
import Incidents from "./Incidents"
import Overview from "./Overview"
import ProjectDetail from "./ProjectDetail"

export default function App() {
  const [hash, setHash] = useState(() => window.location.hash)

  useEffect(() => {
    const onHash = () => setHash(window.location.hash)
    window.addEventListener("hashchange", onHash)
    return () => window.removeEventListener("hashchange", onHash)
  }, [])

  if (hash === "#/incidents") return <Incidents />
  if (hash === "#/import") return <ImportCloudflare />
  const match = /^#\/projects\/(\d+)$/.exec(hash)
  if (match) return <ProjectDetail projectId={Number(match[1])} />
  return <Overview />
}
