import { APP_SLUG } from "@/lib/brand"

export const PRACTICE_TRANSLATE_PATH = "/api/practice/translate"
export const PRACTICE_COOKIE = `${APP_SLUG}.practice-endpoint`
export const PRACTICE_STORAGE_KEY = `${APP_SLUG}.practice-endpoint`
export const PRACTICE_TOKEN = "practice-key"
export const PRACTICE_SLOW_MS = 2_500

export type PracticeToggle = {
  reachable: boolean
  authenticated: boolean
  requestValid: boolean
  expectedOutput: boolean
  latency: boolean
}

export type PracticeConfig = PracticeToggle & {
  token: string
}

const TOGGLE_KEYS = [
  "reachable",
  "authenticated",
  "requestValid",
  "expectedOutput",
  "latency",
] as const

export function defaultPracticeConfig(): PracticeConfig {
  return {
    reachable: true,
    authenticated: true,
    requestValid: true,
    expectedOutput: true,
    latency: true,
    token: PRACTICE_TOKEN,
  }
}

export function matchesPracticeToken(secret: string, config: PracticeConfig = defaultPracticeConfig()) {
  const token = secret.trim()
  if (!token) return false
  return token === PRACTICE_TOKEN || token === config.token.trim()
}

export function isPracticeEndpoint(url: string): boolean {
  try {
    const path = new URL(url.trim()).pathname.replace(/\/+$/, "")
    return path === PRACTICE_TRANSLATE_PATH || path === "/api/practice/v2/translate"
  } catch {
    return false
  }
}

export function practiceTranslateUrl(origin: string): string {
  return `${origin.replace(/\/+$/, "")}${PRACTICE_TRANSLATE_PATH}`
}

export function parsePracticeConfig(raw: unknown): PracticeConfig {
  const fallback = defaultPracticeConfig()
  const record =
    typeof raw === "string"
      ? (safeJson(raw) as Record<string, unknown> | null)
      : raw && typeof raw === "object"
        ? (raw as Record<string, unknown>)
        : null
  if (!record) return fallback

  const next = { ...fallback }
  for (const key of TOGGLE_KEYS) {
    if (typeof record[key] === "boolean") next[key] = record[key]
  }
  if (typeof record.token === "string" && record.token.trim()) {
    next.token = record.token.trim()
  }
  return next
}

export function parsePracticeCookie(cookieHeader: string | null | undefined): PracticeConfig {
  if (!cookieHeader) return defaultPracticeConfig()
  for (const part of cookieHeader.split(";")) {
    const separator = part.indexOf("=")
    if (separator < 0) continue
    const name = part.slice(0, separator).trim()
    if (name !== PRACTICE_COOKIE) continue
    return parsePracticeConfig(decodeURIComponent(part.slice(separator + 1).trim()))
  }
  return defaultPracticeConfig()
}

export function readStoredPracticeConfig(): PracticeConfig {
  if (typeof window === "undefined") return defaultPracticeConfig()
  try {
    const stored = window.localStorage.getItem(PRACTICE_STORAGE_KEY)
    if (stored) return parsePracticeConfig(stored)
  } catch {
    /* ignore quota / private mode */
  }
  return parsePracticeCookie(typeof document === "undefined" ? null : document.cookie)
}

export function serializePracticeCookie(config: PracticeConfig): string {
  return `${PRACTICE_COOKIE}=${encodeURIComponent(JSON.stringify(parsePracticeConfig(config)))}; Path=/; SameSite=Lax; Max-Age=31536000`
}

function safeJson(raw: string): unknown {
  try {
    return JSON.parse(raw)
  } catch {
    return null
  }
}
