import type { Overall, RequestMethod } from "@/lib/probe/types"

import { APP_SLUG } from "@/lib/brand"

export const SAVED_TESTS_KEY = `${APP_SLUG}.saved-tests`
export const SAVED_TESTS_MAX = 30

export type SavedTest = {
  id: string
  at: number
  url: string
  method: RequestMethod
  overall: Overall
  title: string
  explanation: string
  status?: number
  durationMs: number
}

export type SavedTestInput = Omit<SavedTest, "id" | "at"> & {
  id?: string
  at?: number
}

const METHODS = new Set<RequestMethod>(["GET", "POST"])
const OVERALLS = new Set<Overall>(["healthy", "degraded", "misconfigured", "unavailable"])

const TITLE_ALIASES: Record<string, string> = {
  "The functional request succeeded": "The test succeeded",
}

export function savedTestTitle(title: string) {
  return TITLE_ALIASES[title] ?? title
}

export function testLabel(url: string): string {
  try {
    const parsed = new URL(url)
    const path = parsed.pathname === "/" ? "" : parsed.pathname
    return `${parsed.host}${path}`
  } catch {
    return url
  }
}

export function formatSavedAt(at: number): string {
  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(at)
}

export function isSavedTest(value: unknown): value is SavedTest {
  if (!value || typeof value !== "object") return false
  const item = value as Record<string, unknown>
  return (
    typeof item.id === "string" &&
    typeof item.at === "number" &&
    typeof item.url === "string" &&
    METHODS.has(item.method as RequestMethod) &&
    OVERALLS.has(item.overall as Overall) &&
    typeof item.title === "string" &&
    typeof item.explanation === "string" &&
    typeof item.durationMs === "number" &&
    (item.status === undefined || typeof item.status === "number")
  )
}

export function readSavedTests(): SavedTest[] {
  if (typeof window === "undefined") return []
  try {
    const raw = window.localStorage.getItem(SAVED_TESTS_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw) as unknown
    if (!Array.isArray(parsed)) return []
    return parsed
      .filter(isSavedTest)
      .map((item) => ({ ...item, title: savedTestTitle(item.title) }))
      .slice(0, SAVED_TESTS_MAX)
  } catch {
    return []
  }
}

export function writeSavedTests(tests: SavedTest[]): SavedTest[] {
  const next = tests.slice(0, SAVED_TESTS_MAX)
  window.localStorage.setItem(SAVED_TESTS_KEY, JSON.stringify(next))
  return next
}

export function toSavedTest(input: SavedTestInput): SavedTest {
  return {
    id: input.id ?? crypto.randomUUID(),
    at: input.at ?? Date.now(),
    url: input.url.trim(),
    method: input.method,
    overall: input.overall,
    title: savedTestTitle(input.title),
    explanation: input.explanation,
    status: input.status,
    durationMs: input.durationMs,
  }
}
