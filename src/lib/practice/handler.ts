import {
  PRACTICE_SLOW_MS,
  PRACTICE_TOKEN,
  PRACTICE_TRANSLATE_PATH,
  type PracticeConfig,
} from "@/lib/practice/config"
import { isAuthFieldKey } from "@/lib/probe/defaults"
import type { TimedFetchResult } from "@/lib/probe/types"

function json(body: unknown, status = 200): Response {
  return Response.json(body, {
    status,
    headers: { "Content-Type": "application/json; charset=utf-8" },
  })
}

function bodyToken(record: Record<string, unknown>): string {
  for (const [key, value] of Object.entries(record)) {
    if (typeof value === "string" && isAuthFieldKey(key) && value.trim()) {
      return value.trim()
    }
  }
  return ""
}

function acceptsToken(config: PracticeConfig, apiKey: string) {
  if (!apiKey) return false
  return apiKey === config.token.trim() || apiKey === PRACTICE_TOKEN
}

function pathnameOf(request: Request): string {
  try {
    return new URL(request.url).pathname.replace(/\/+$/, "")
  } catch {
    return ""
  }
}

export function translatePractice(text: string, source: string, target: string): string {
  const input = text.trim()
  if (source.trim().toLowerCase() === "en" && target.trim().toLowerCase() === "tw" && /^hello$/i.test(input)) {
    return "Agoo"
  }
  return target.trim() ? `${input} [${target.trim()}]` : input
}

export async function handlePracticeRequest(
  request: Request,
  config: PracticeConfig,
): Promise<Response> {
  if (!config.reachable) {
    return json({ error: "Service unavailable" }, 503)
  }

  if (!config.latency) {
    await new Promise((resolve) => setTimeout(resolve, PRACTICE_SLOW_MS))
  }

  const path = pathnameOf(request)
  if (path !== PRACTICE_TRANSLATE_PATH && path !== "/api/practice/v2/translate") {
    return json({ error: "Not found" }, 404)
  }

  if (request.method !== "POST") {
    return json({ error: "Method not allowed" }, 405)
  }

  let payload: unknown
  try {
    payload = await request.json()
  } catch {
    return json({ error: "Invalid request body" }, 400)
  }

  const record = payload && typeof payload === "object" ? (payload as Record<string, unknown>) : {}
  const apiKey = bodyToken(record)
  if (!config.authenticated || !acceptsToken(config, apiKey)) {
    return json({ detail: "Unauthorized" }, 401)
  }

  if (!config.requestValid) {
    return json({ detail: "Invalid request body" }, 400)
  }

  const text = typeof record.text === "string" ? record.text : ""
  const source = typeof record.source === "string" ? record.source : ""
  const target = typeof record.target === "string" ? record.target : ""
  if (!text.trim() || !source.trim() || !target.trim()) {
    return json({ detail: "Invalid request body" }, 400)
  }

  if (!config.expectedOutput) {
    return json({ message: "ok", echo: text })
  }

  return json({ translatedText: translatePractice(text, source, target) })
}

export async function practiceTimedResult(
  url: string,
  init: { method: string; headers: Record<string, string>; body?: string },
  config: PracticeConfig,
): Promise<TimedFetchResult> {
  const started = performance.now()

  if (!config.reachable) {
    if (!config.latency) {
      await new Promise((resolve) => setTimeout(resolve, PRACTICE_SLOW_MS))
    }
    return {
      ok: false,
      headers: {},
      bodyText: "",
      bytes: 0,
      durationMs: Math.round(performance.now() - started),
      error: { kind: "network", message: "Connection refused. The API may be down." },
    }
  }

  const request = new Request(url, {
    method: init.method,
    headers: init.headers,
    body: init.method !== "GET" && init.method !== "HEAD" && init.body ? init.body : undefined,
  })
  const response = await handlePracticeRequest(request, config)
  const bodyText = await response.text()
  const headers: Record<string, string> = {}
  response.headers.forEach((value, key) => {
    headers[key] = value
  })

  return {
    ok: response.ok,
    status: response.status,
    statusText: response.statusText,
    headers,
    bodyText,
    contentType: headers["content-type"],
    bytes: new TextEncoder().encode(bodyText).length,
    durationMs: Math.round(performance.now() - started),
  }
}
