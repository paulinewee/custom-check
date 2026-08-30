import { isPracticeEndpoint } from "@/lib/practice/config"

export function validateEndpointUrl(raw: string): string | null {
  const trimmed = raw.trim()
  if (!trimmed) return "Enter an http(s) endpoint."

  let parsed: URL
  try {
    parsed = new URL(trimmed)
  } catch {
    return "That is not a valid URL. Enter a full address starting with http:// or https://."
  }

  if (parsed.protocol !== "https:" && parsed.protocol !== "http:") {
    return "Only http and https endpoints can be tested. Use an http(s) address."
  }

  if (isPracticeEndpoint(trimmed)) return null

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
    return new URL(raw.trim())
  } catch {
    return null
  }
}
