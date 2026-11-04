export async function getJson<T>(url: string): Promise<T> {
  const res = await fetch(url)
  if (!res.ok) {
    const body = (await res.text()).trim()
    throw new Error(body || `${url}: HTTP ${res.status}`)
  }
  return res.json()
}
