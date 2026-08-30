import { maskSecret } from "@/lib/probe/log"
import type { TestRequest } from "@/lib/probe/types"

function shellQuote(value: string): string {
  return `'${value.replace(/'/g, `'\\''`)}'`
}

export function buildCurl(request: TestRequest, mask = true): string {
  let url: URL
  try {
    url = new URL(request.url)
  } catch {
    return "curl will appear as you build the request."
  }
  const headers = { ...request.headers }

  if (request.auth?.secret) {
    if (request.auth.kind === "query") {
      url.searchParams.set(request.auth.queryName || "api_key", request.auth.secret)
    } else if (request.auth.kind === "bearer") {
      headers.Authorization = `Bearer ${request.auth.secret}`
    } else {
      headers[request.auth.headerName || "X-API-Key"] = request.auth.secret
    }
  }

  const parts = [`curl -X ${request.method} ${shellQuote(url.toString())}`]

  for (const [key, value] of Object.entries(headers)) {
    if (!key.trim() || !value) continue
    const safe =
      mask && (key.toLowerCase().includes("key") || key.toLowerCase() === "authorization")
        ? maskSecret(value) ?? "••••"
        : value
    parts.push(`  -H ${shellQuote(`${key}: ${safe}`)}`)
  }

  if (request.method === "POST" && request.body?.trim()) {
    parts.push(`  -d ${shellQuote(request.body.trim())}`)
  }

  return parts.join(" \\\n")
}
