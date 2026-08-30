import { lookup } from "node:dns/promises"
import { isIP } from "node:net"

import { isPracticeEndpoint } from "@/lib/practice/config"

export class UrlValidationError extends Error {
  constructor(message: string) {
    super(message)
    this.name = "UrlValidationError"
  }
}

const BLOCKED_HOSTS = new Set([
  "localhost",
  "localhost.localdomain",
  "metadata.google.internal",
  "metadata.google",
])

function ipv4ToInt(ip: string): number {
  return ip.split(".").reduce((acc, octet) => (acc << 8) + Number(octet), 0) >>> 0
}

function isPrivateIPv4(ip: string): boolean {
  const n = ipv4ToInt(ip)
  return (
    (n >= ipv4ToInt("10.0.0.0") && n <= ipv4ToInt("10.255.255.255")) ||
    (n >= ipv4ToInt("127.0.0.0") && n <= ipv4ToInt("127.255.255.255")) ||
    (n >= ipv4ToInt("169.254.0.0") && n <= ipv4ToInt("169.254.255.255")) ||
    (n >= ipv4ToInt("172.16.0.0") && n <= ipv4ToInt("172.31.255.255")) ||
    (n >= ipv4ToInt("192.168.0.0") && n <= ipv4ToInt("192.168.255.255")) ||
    (n >= ipv4ToInt("0.0.0.0") && n <= ipv4ToInt("0.255.255.255"))
  )
}

function isPrivateIPv6(ip: string): boolean {
  const normalized = ip.toLowerCase()
  return (
    normalized === "::1" ||
    normalized === "::" ||
    normalized.startsWith("fc") ||
    normalized.startsWith("fd") ||
    normalized.startsWith("fe80")
  )
}

function isBlockedAddress(address: string): boolean {
  const version = isIP(address)
  if (version === 4) return isPrivateIPv4(address)
  if (version === 6) return isPrivateIPv6(address)
  return false
}

export function parsePublicHttpUrl(raw: string): URL {
  const trimmed = raw.trim()
  if (!trimmed) {
    throw new UrlValidationError("Paste an http(s) endpoint to probe.")
  }

  let parsed: URL
  try {
    parsed = new URL(trimmed)
  } catch {
    throw new UrlValidationError("That does not look like a valid URL.")
  }

  if (parsed.protocol !== "https:" && parsed.protocol !== "http:") {
    throw new UrlValidationError("Only http and https endpoints can be probed.")
  }

  if (isPracticeEndpoint(trimmed)) return parsed

  const host = parsed.hostname.toLowerCase()
  if (BLOCKED_HOSTS.has(host) || host.endsWith(".localhost") || host.endsWith(".internal")) {
    throw new UrlValidationError("Private or local hosts cannot be probed.")
  }

  if (isIP(host) && isBlockedAddress(host)) {
    throw new UrlValidationError("Private IP addresses cannot be probed.")
  }

  return parsed
}

export async function assertPublicTarget(url: URL): Promise<void> {
  if (isPracticeEndpoint(url.toString())) return
  if (isIP(url.hostname)) return

  try {
    const { address } = await lookup(url.hostname, { all: false })
    if (isBlockedAddress(address)) {
      throw new UrlValidationError("That host resolves to a private address.")
    }
  } catch (error) {
    if (error instanceof UrlValidationError) throw error
    throw new UrlValidationError("The hostname could not be resolved.")
  }
}
