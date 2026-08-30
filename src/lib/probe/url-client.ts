import { isPracticeEndpoint } from "@/lib/practice/config"

function isLocalHostname(host: string): boolean {
  const name = host.toLowerCase()
  return name === "localhost" || name === "127.0.0.1" || name === "0.0.0.0" || name === "::1"
}

export function normalizeEndpointUrl(raw: string): string {
  const trimmed = raw.trim()
  if (!trimmed) return ""
  if (/^[a-zA-Z][a-zA-Z+\-.]*:\/\//.test(trimmed)) return trimmed

  if (trimmed.startsWith("//")) {
    const host = trimmed.slice(2).split("/")[0]?.split(":")[0] ?? ""
    return `${isLocalHostname(host) ? "http" : "https"}:${trimmed}`
  }

  const host = trimmed.split("/")[0]?.split(":")[0] ?? ""
  return `${isLocalHostname(host) ? "http" : "https"}://${trimmed}`
}

export function validateEndpointUrl(raw: string): string | null {
  const trimmed = raw.trim()
  if (!trimmed) return "Enter an http(s) endpoint."

  const normalized = normalizeEndpointUrl(trimmed)
  let parsed: URL
  try {
    parsed = new URL(normalized)
  } catch {
    return "That is not a valid URL. Enter a host such as api.huniki.ai/translate."
  }

  if (parsed.protocol !== "https:" && parsed.protocol !== "http:") {
    return "Only http and https endpoints can be tested. Use an http(s) address."
  }

  if (isPracticeEndpoint(normalized)) return null

  const host = parsed.hostname.toLowerCase()
  if (
    host === "localhost" ||
    host.endsWith(".localhost") ||
    host.endsWith(".internal") ||
    host === "127.0.0.1" ||
    host === "0.0.0.0" ||
    host === "::1"
  ) {
    return "Private or local hosts cannot be tested. Use a public hostname."
  }

  return null
}

export function parseEndpointUrl(raw: string): URL | null {
  if (validateEndpointUrl(raw)) return null
  try {
    return new URL(normalizeEndpointUrl(raw))
  } catch {
    return null
  }
}
