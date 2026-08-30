import { BODY_PREVIEW_CHARS } from "@/lib/probe/constants"
import type { FetchErrorKind, TimedFetchResult } from "@/lib/probe/types"

function truncateBody(value: string): string {
  if (value.length <= BODY_PREVIEW_CHARS) return value
  return `${value.slice(0, BODY_PREVIEW_CHARS)}\n…truncated`
}

function isLikelyBinary(contentType: string | undefined, sample: Uint8Array): boolean {
  if (contentType?.startsWith("text/")) return false
  if (contentType?.includes("json") || contentType?.includes("xml") || contentType?.includes("javascript")) {
    return false
  }
  if (contentType?.startsWith("audio/") || contentType?.startsWith("image/") || contentType?.startsWith("video/")) {
    return true
  }
  const probe = sample.subarray(0, 32)
  return probe.some((byte) => byte === 0)
}

function headersToObject(headers: Headers): Record<string, string> {
  const result: Record<string, string> = {}
  headers.forEach((value, key) => {
    result[key] = value
  })
  return result
}

function classifyError(error: unknown): { kind: FetchErrorKind; message: string } {
  if (error instanceof DOMException && (error.name === "TimeoutError" || error.name === "AbortError")) {
    return {
      kind: "timeout",
      message: "The server did not respond before the timeout.",
    }
  }

  if (error instanceof Error) {
    const code = "code" in error ? String(error.code).toLowerCase() : ""
    const message = error.message.toLowerCase()

    if (code === "enotfound" || message.includes("getaddrinfo") || message.includes("enotfound")) {
      return { kind: "dns", message: "The hostname could not be resolved." }
    }
    if (code === "econnrefused" || message.includes("econnrefused")) {
      return { kind: "network", message: "Connection refused. The API may be down." }
    }
    if (code === "econnreset" || message.includes("econnreset")) {
      return { kind: "network", message: "The server reset the connection." }
    }
    if (code === "etimedout" || message.includes("etimedout")) {
      return { kind: "timeout", message: "The connection timed out." }
    }
    if (message.includes("certificate") || message.includes("ssl") || message.includes("tls")) {
      return { kind: "tls", message: "The TLS handshake failed." }
    }
    if (error.name === "TimeoutError" || error.name === "AbortError") {
      return { kind: "timeout", message: "The server did not respond before the timeout." }
    }
  }

  return { kind: "network", message: "The request failed before a response arrived." }
}

export async function timedFetch(
  url: string,
  init: RequestInit,
  timeoutMs: number,
): Promise<TimedFetchResult> {
  const started = performance.now()
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), timeoutMs)

  const userSignal = init.signal
  const onUserAbort = () => controller.abort()
  userSignal?.addEventListener("abort", onUserAbort, { once: true })

  try {
    const response = await fetch(url, {
      ...init,
      redirect: "follow",
      cache: "no-store",
      signal: controller.signal,
    })

    const ttfbMs = Math.round(performance.now() - started)
    const contentType = response.headers.get("content-type") ?? undefined
    const raw = new Uint8Array(await response.arrayBuffer())
    const durationMs = Math.round(performance.now() - started)

    const bodyText = isLikelyBinary(contentType, raw)
      ? `[binary body · ${raw.byteLength} bytes]`
      : truncateBody(new TextDecoder().decode(raw))

    return {
      ok: response.ok,
      status: response.status,
      statusText: response.statusText,
      headers: headersToObject(response.headers),
      bodyText,
      contentType,
      bytes: raw.byteLength,
      durationMs,
      ttfbMs,
    }
  } catch (error) {
    const durationMs = Math.round(performance.now() - started)
    const classified = classifyError(error)
    const kind = classified.kind === "timeout" && durationMs >= timeoutMs - 20 ? "freeze" : classified.kind

    return {
      ok: false,
      headers: {},
      bodyText: "",
      bytes: 0,
      durationMs,
      error: {
        kind,
        message:
          kind === "freeze"
            ? `No response in ${timeoutMs} ms. The process may be frozen or overloaded.`
            : classified.message,
      },
    }
  } finally {
    clearTimeout(timeout)
    userSignal?.removeEventListener("abort", onUserAbort)
  }
}

export function pickHeader(
  headers: Record<string, string>,
  name: string,
): string | undefined {
  const target = name.toLowerCase()
  return Object.entries(headers).find(([key]) => key.toLowerCase() === target)?.[1]
}
