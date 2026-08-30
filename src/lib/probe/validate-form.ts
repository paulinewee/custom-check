import { MAX_GAP_MS, MAX_REQUESTS, RUN_TIMEOUT_MAX_MS } from "@/lib/probe/constants"
import type { BodyKind, BodyField, FieldValues } from "@/lib/probe/defaults"
import type { RequestMethod, SendMode } from "@/lib/probe/types"

export function validateSecret(value: string): string | null {
  if (!value.trim()) {
    return "Enter an authentication token. Paste the value from your provider."
  }
  return null
}

export function validateTranslateText(value: string): string | null {
  if (!value.trim()) {
    return "Enter the text to send. Add a sample phrase, then retest."
  }
  return null
}

export function validateLanguageCode(value: string, label: "source" | "target"): string | null {
  const trimmed = value.trim()
  if (!trimmed) {
    return `Enter a ${label} language code. Use a code such as en or eng_Latn.`
  }
  if (!/^[A-Za-z]{2,16}(?:[_-][A-Za-z0-9]{1,16})*$/.test(trimmed)) {
    return `That ${label} code is not valid. Use a code such as en or eng_Latn.`
  }
  return null
}

export function validateLangPair(value: string): string | null {
  const trimmed = value.trim()
  if (!trimmed) {
    return "Enter a lang pair. Use a value such as en-tw."
  }
  if (!/^[A-Za-z]{2,8}-[A-Za-z0-9]{1,8}(?:-[A-Za-z0-9]{1,8})*$/.test(trimmed)) {
    return "That lang pair is not valid. Use a value such as en-tw."
  }
  return null
}

export function validateJsonBody(value: string): string | null {
  if (!value.trim()) {
    return "Enter a JSON body. Add the request payload, then retest."
  }
  try {
    JSON.parse(value)
  } catch {
    return "That is not valid JSON. Fix the syntax and try again."
  }
  return null
}

export function validateContentType(value: string): string | null {
  const trimmed = value.trim()
  if (!trimmed) {
    return "Enter a Content-Type. Use a value such as application/json."
  }
  if (
    !/^[A-Za-z0-9][A-Za-z0-9!#$&\-^_.+]*\/[A-Za-z0-9][A-Za-z0-9!#$&\-^_.+]*(?:\s*;\s*.+)?$/.test(
      trimmed,
    )
  ) {
    return "That is not a valid media type. Use a value such as application/json."
  }
  return null
}

export function validateLatencyMs(value: string): string | null {
  const trimmed = value.trim()
  if (!trimmed) {
    return "Enter how many milliseconds before a response is too slow."
  }
  if (!/^\d+$/.test(trimmed)) {
    return "Enter a whole number of milliseconds."
  }
  const next = Number(trimmed)
  if (next < 1) {
    return "That limit must be at least 1 ms. Enter a positive number."
  }
  if (next > RUN_TIMEOUT_MAX_MS) {
    return `That limit must be ${RUN_TIMEOUT_MAX_MS} ms or less. Lower it and try again.`
  }
  return null
}

export function validateRequestCount(value: string): string | null {
  const trimmed = value.trim()
  if (!trimmed) {
    return "Enter how many times to send this check."
  }
  if (!/^\d+$/.test(trimmed)) {
    return "Enter a whole number of requests."
  }
  const next = Number(trimmed)
  if (next < 1) {
    return "Send at least 1 request."
  }
  if (next > MAX_REQUESTS) {
    return `Send ${MAX_REQUESTS} requests or fewer.`
  }
  return null
}

export function validateGapMs(value: string): string | null {
  const trimmed = value.trim()
  if (!trimmed) {
    return "Enter the delay between requests in milliseconds."
  }
  if (!/^\d+$/.test(trimmed)) {
    return "Enter a whole number of milliseconds."
  }
  const next = Number(trimmed)
  if (next < 0) {
    return "The delay cannot be negative."
  }
  if (next > MAX_GAP_MS) {
    return `The delay must be ${MAX_GAP_MS} ms or less.`
  }
  return null
}

export type RequestFieldId =
  | "text"
  | "source"
  | "target"
  | "lang"
  | "raw-body"
  | "content-type"
  | "latency"
  | "count"
  | "gap"

export type RequestFieldErrors = Partial<Record<RequestFieldId, string>>

export function validateRequestForm(input: {
  method: RequestMethod
  bodyKind: BodyKind
  fields: readonly BodyField[]
  rawMode: boolean
  values: FieldValues
  rawBody: string
  defaultBody: string
  contentType: string
  latencyMs: string
  requestCount?: string
  sendMode?: SendMode
  gapMs?: string
}): { errors: RequestFieldErrors; firstId: RequestFieldId | null } {
  const errors: RequestFieldErrors = {}
  const hasBody = input.method === "POST" && input.bodyKind !== "none"

  if (hasBody) {
    if (input.rawMode) {
      const raw = validateJsonBody(input.rawBody || input.defaultBody)
      if (raw) errors["raw-body"] = raw
    } else {
      for (const field of input.fields) {
        const value = input.values[field.role]
        const invalid =
          field.role === "text"
            ? validateTranslateText(value)
            : field.role === "lang"
              ? validateLangPair(value)
              : validateLanguageCode(value, field.role)
        if (invalid) errors[field.role] = invalid
      }
    }
    const contentType = validateContentType(input.contentType)
    if (contentType) errors["content-type"] = contentType
  }

  const latency = validateLatencyMs(input.latencyMs)
  if (latency) errors.latency = latency

  const count = validateRequestCount(input.requestCount ?? "1")
  if (count) errors.count = count

  if ((input.sendMode ?? "sequential") === "delayed") {
    const gap = validateGapMs(input.gapMs ?? "")
    if (gap) errors.gap = gap
  }

  const order: RequestFieldId[] = [
    "text",
    "source",
    "target",
    "lang",
    "raw-body",
    "content-type",
    "count",
    "gap",
    "latency",
  ]
  const firstId = order.find((id) => errors[id]) ?? null
  return { errors, firstId }
}
