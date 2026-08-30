import {
  PRACTICE_LANGUAGES_PATH,
  PRACTICE_SLOW_MS,
  PRACTICE_TRANSLATE_PATH,
  type PracticeConfig,
} from "@/lib/practice/config"
import type { TimedFetchResult } from "@/lib/probe/types"

export const PRACTICE_LANGUAGES: Record<string, string> = {
  en: "English",
  tw: "Twi",
  ee: "Ewe",
  ga: "Ga",
  fat: "Fante",
  yo: "Yoruba",
  ha: "Hausa",
}

function json(body: unknown, status = 200): Response {
  return Response.json(body, {
    status,
    headers: { "Content-Type": "application/json; charset=utf-8" },
  })
}

function header(request: Request, name: string): string {
  return request.headers.get(name) ?? ""
}

function pathnameOf(request: Request): string {
  try {
    return new URL(request.url).pathname.replace(/\/+$/, "")
  } catch {
    return ""
  }
}

export function translatePractice(text: string, lang: string): string {
  const pair = lang.trim().toLowerCase()
  const input = text.trim()
  if (pair === "en-tw" && /^hello$/i.test(input)) return "Agoo"
  const target = pair.includes("-") ? pair.slice(pair.indexOf("-") + 1) : pair
  return target ? `${input} [${target}]` : input
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

  const token = header(request, "Ocp-Apim-Subscription-Key").trim()
  if (!config.authenticated || !token || token !== config.token.trim()) {
    return json({ error: "Unauthorized" }, 401)
  }

  const path = pathnameOf(request)
  const languages = path === PRACTICE_LANGUAGES_PATH || request.method === "GET"

  if (languages) {
    if (!config.languages) {
      return json({ error: "Languages are unavailable" }, 503)
    }
    return json(PRACTICE_LANGUAGES)
  }

  if (path !== PRACTICE_TRANSLATE_PATH) {
    return json({ error: "Not found" }, 404)
  }

  if (!config.requestValid) {
    return json({ error: "Invalid request body" }, 400)
  }

  let payload: unknown
  try {
    payload = await request.json()
  } catch {
    return json({ error: "Invalid request body" }, 400)
  }

  const record = payload && typeof payload === "object" ? (payload as Record<string, unknown>) : {}
  const text = typeof record.in === "string" ? record.in : ""
  const lang = typeof record.lang === "string" ? record.lang : ""
  if (!text.trim() || !lang.trim()) {
    return json({ error: "Invalid request body" }, 400)
  }

  if (!config.expectedOutput) {
    return json({ message: "ok", echo: text })
  }

  return json({ translatedText: translatePractice(text, lang) })
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
