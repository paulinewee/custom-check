import { APP_SLUG } from "@/lib/brand"
import { DEFAULT_LATENCY_MS } from "@/lib/probe/constants"
import {
  HUNIKI_SHAPE,
  fieldsFromSampleJson,
  isBodyFieldRole,
  type BodyField,
  type BodyFieldRole,
  type TranslateShape,
} from "@/lib/probe/defaults"
import type { AuthKind } from "@/lib/probe/types"

export const SETTINGS_KEY = `${APP_SLUG}.check-settings`

export const AUTH_KIND_OPTIONS = [
  { value: "body", label: "Request body" },
  { value: "api_key", label: "Header" },
  { value: "bearer", label: "Bearer token" },
] as const

export const FIELD_ROLE_OPTIONS: { value: BodyFieldRole; label: string }[] = [
  { value: "text", label: "Text" },
  { value: "source", label: "Source language" },
  { value: "target", label: "Target language" },
  { value: "provider", label: "Provider" },
  { value: "custom", label: "Other" },
]

export type CheckSettings = {
  shape: TranslateShape
  authKind: AuthKind
  authKey: string
  latencyMs: number
  emptyPath: string
  flagEmpty: boolean
}

export const DEFAULT_SETTINGS: CheckSettings = {
  shape: HUNIKI_SHAPE,
  authKind: "body",
  authKey: "api_key",
  latencyMs: DEFAULT_LATENCY_MS,
  emptyPath: "translatedText",
  flagEmpty: true,
}

const AUTH_KINDS = new Set<AuthKind>(["bearer", "api_key", "query", "body"])

function sanitizeField(value: unknown): BodyField | null {
  if (!value || typeof value !== "object") return null
  const record = value as Record<string, unknown>
  const key = typeof record.key === "string" ? record.key.trim() : ""
  if (!key) return null
  const role = typeof record.role === "string" && isBodyFieldRole(record.role) ? record.role : "custom"
  const label = typeof record.label === "string" && record.label.trim() ? record.label.trim() : key
  const sample = typeof record.sample === "string" ? record.sample : ""
  return { key, role, label, sample }
}

function sanitizeShape(value: unknown): TranslateShape {
  if (!value || typeof value !== "object") return HUNIKI_SHAPE
  const record = value as Record<string, unknown>
  const rawFields = Array.isArray(record.fields) ? record.fields : []
  const seen = new Set<string>()
  const fields: BodyField[] = []
  for (const item of rawFields) {
    const field = sanitizeField(item)
    if (!field || seen.has(field.key)) continue
    seen.add(field.key)
    fields.push(field)
  }
  if (fields.length === 0) return HUNIKI_SHAPE
  const nextFields = migrateDefaultInputSample(fields)
  const id = record.id === "custom" || nextFields !== HUNIKI_SHAPE.fields ? "custom" : "huniki"
  const looksDefault =
    nextFields.length === HUNIKI_SHAPE.fields.length &&
    nextFields.every((field, index) => {
      const expected = HUNIKI_SHAPE.fields[index]
      return (
        expected &&
        field.key === expected.key &&
        field.role === expected.role &&
        field.label === expected.label &&
        field.sample === expected.sample
      )
    })
  return { id: looksDefault ? "huniki" : id, fields: nextFields }
}

function migrateDefaultInputSample(fields: BodyField[]): BodyField[] {
  const expected = HUNIKI_SHAPE.fields
  if (fields.length !== expected.length) return fields
  const matchesHunikiExceptOldText =
    fields.every((field, index) => {
      const want = expected[index]
      if (!want) return false
      if (field.key !== want.key || field.role !== want.role || field.label !== want.label) return false
      if (field.role === "text") return field.sample === "Hello" || field.sample === want.sample
      return field.sample === want.sample
    })
  return matchesHunikiExceptOldText ? expected.map((field) => ({ ...field })) : fields
}

export function parseCheckSettings(value: unknown): CheckSettings {
  if (!value || typeof value !== "object") return { ...DEFAULT_SETTINGS }
  const record = value as Record<string, unknown>
  const latency = Number(record.latencyMs)
  const authKind = AUTH_KINDS.has(record.authKind as AuthKind)
    ? (record.authKind as AuthKind)
    : DEFAULT_SETTINGS.authKind
  const authKey =
    typeof record.authKey === "string" && record.authKey.trim()
      ? record.authKey.trim()
      : DEFAULT_SETTINGS.authKey
  const emptyPath =
    typeof record.emptyPath === "string" && record.emptyPath.trim()
      ? record.emptyPath.trim()
      : DEFAULT_SETTINGS.emptyPath
  return {
    shape: sanitizeShape(record.shape),
    authKind,
    authKey,
    latencyMs: Number.isFinite(latency) && latency >= 1 ? Math.floor(latency) : DEFAULT_SETTINGS.latencyMs,
    emptyPath,
    flagEmpty: record.flagEmpty !== false,
  }
}

export function readSettings(): CheckSettings {
  try {
    const raw = window.localStorage.getItem(SETTINGS_KEY)
    if (!raw) return { ...DEFAULT_SETTINGS, shape: { ...HUNIKI_SHAPE } }
    return parseCheckSettings(JSON.parse(raw))
  } catch {
    return { ...DEFAULT_SETTINGS, shape: { ...HUNIKI_SHAPE } }
  }
}

export function writeSettings(settings: CheckSettings): CheckSettings {
  const next = parseCheckSettings(settings)
  try {
    window.localStorage.setItem(SETTINGS_KEY, JSON.stringify(next))
  } catch {
    /* ignore quota / private mode */
  }
  return next
}

export function applySampleJson(source: string, current: CheckSettings): CheckSettings {
  const parsed = JSON.parse(source) as unknown
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new Error("Paste a JSON object that matches the request body.")
  }
  const { fields, authKey } = fieldsFromSampleJson(parsed as Record<string, unknown>)
  if (fields.length === 0) {
    throw new Error("That JSON has no fields to send. Add at least one key.")
  }
  return parseCheckSettings({
    ...current,
    shape: { id: "custom", fields },
    authKey: authKey ?? current.authKey,
  })
}

export function defaultSampleJson() {
  const body: Record<string, string> = {}
  for (const field of HUNIKI_SHAPE.fields) body[field.key] = field.sample
  body.api_key = "••••"
  return JSON.stringify(body, null, 2)
}
