import { MAX_REQUESTS, RUN_TIMEOUT_MAX_MS } from "@/lib/probe/constants"
import type { BodyKind, BodyField, FieldValues } from "@/lib/probe/defaults"
import type { RequestMethod } from "@/lib/probe/types"

export function validateSecret(value: string): string | null {
  if (!value.trim()) {
    return "Enter an API key. Paste the Huniki or provider key."
  }
  return null
}

export function validateProvider(value: string): string | null {
  if (!value.trim()) {
    return "Choose a provider. Huniki uses this as api_name."
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

export type RequestFieldId =
  | "text"
  | "source"
  | "target"
  | "provider"
  | "content-type"
  | "latency"
  | "count"
  | (string & {})

export type RequestFieldErrors = Partial<Record<RequestFieldId, string>>

export function validateRequestForm(input: {
  method: RequestMethod
  bodyKind: BodyKind
  fields: readonly BodyField[]
  values: FieldValues
  contentType: string
  latencyMs: string
  requestCount?: string
  allLanguagePairs?: boolean
}): { errors: RequestFieldErrors; firstId: RequestFieldId | null } {
  const errors: RequestFieldErrors = {}
  const hasBody = input.method === "POST" && input.bodyKind !== "none"

  if (hasBody) {
    for (const field of input.fields) {
      const value = input.values[field.key] ?? input.values[field.role] ?? ""
      const errorKey = field.role === "custom" ? field.key : field.role
      const invalid =
        field.role === "text"
          ? validateTranslateText(value)
          : field.role === "provider"
            ? validateProvider(value)
            : field.role === "source" || field.role === "target"
              ? validateLanguageCode(value, field.role)
              : value.trim()
                ? null
                : `Enter ${field.label}. Add a value, then retest.`
      if (invalid) errors[errorKey] = invalid
    }
    const contentType = validateContentType(input.contentType)
    if (contentType) errors["content-type"] = contentType
  }

  const latency = validateLatencyMs(input.latencyMs)
  if (latency) errors.latency = latency

  if (!input.allLanguagePairs) {
    const count = validateRequestCount(input.requestCount ?? "1")
    if (count) errors.count = count
  }

  const order: RequestFieldId[] = [
    "text",
    "source",
    "target",
    "provider",
    "content-type",
    "count",
    "latency",
  ]
  const firstId = order.find((id) => errors[id]) ?? null
  return { errors, firstId }
}

const CUSTOMIZE_FIELD_IDS: RequestFieldId[] = [
  "text",
  "source",
  "target",
  "provider",
  "content-type",
  "count",
]

export function firstCustomizeError(errors: RequestFieldErrors): RequestFieldId | null {
  const extras = Object.keys(errors).filter(
    (id) => id !== "latency" && !CUSTOMIZE_FIELD_IDS.includes(id as RequestFieldId),
  )
  return [...CUSTOMIZE_FIELD_IDS, ...extras].find((id) => errors[id]) ?? null
}
