import type { AuthKind, RequestMethod } from "@/lib/probe/types"

export type BodyKind = "none" | "translate"
export type BodyFieldRole = "text" | "source" | "target" | "provider" | "custom"

export type BodyField = {
  key: string
  role: BodyFieldRole
  label: string
  sample: string
}

export type TranslateShape = {
  id: "huniki" | "custom"
  fields: readonly BodyField[]
}

export type FieldValues = Record<string, string>

export const BODY_FIELD_ROLES = ["text", "source", "target", "provider", "custom"] as const

const AUTH_KEY_NAMES = new Set(["api_key", "apikey", "access_token", "token", "key", "authorization"])

export type EndpointDefaults = {
  method: RequestMethod
  authKind: AuthKind
  headerName: string
  bodyKind: BodyKind
  shape: TranslateShape
}

export const HUNIKI_PROVIDERS = [
  { value: "ghananlp", label: "GhanaNLP" },
  { value: "lelapa", label: "Lelapa" },
  { value: "lesan", label: "Lesan" },
] as const

export type HunikiProvider = (typeof HUNIKI_PROVIDERS)[number]["value"]

export const HUNIKI_LANGUAGES = [
  { code: "en", name: "English" },
  { code: "tw", name: "Twi" },
  { code: "ee", name: "Ewe" },
  { code: "gaa", name: "Ga" },
  { code: "fat", name: "Fante" },
  { code: "dag", name: "Dagbani" },
  { code: "gur", name: "Gurene" },
  { code: "yo", name: "Yoruba" },
  { code: "ki", name: "Kikuyu" },
  { code: "luo", name: "Luo" },
  { code: "mer", name: "Meru" },
  { code: "am", name: "Amharic" },
  { code: "ti", name: "Tigrinya" },
  { code: "zul", name: "Zulu" },
  { code: "sot", name: "Sesotho" },
  { code: "afr", name: "Afrikaans" },
  { code: "swa", name: "Swahili" },
  { code: "xho", name: "Xhosa" },
  { code: "eng_Latn", name: "English (Latn)" },
  { code: "zul_Latn", name: "Zulu (Latn)" },
] as const

export const DEFAULT_INPUT_SAMPLE = "The quick brown fox jumps over the lazy dog."

export const HUNIKI_SHAPE: TranslateShape = {
  id: "huniki",
  fields: [
    { key: "text", role: "text", label: "Input", sample: DEFAULT_INPUT_SAMPLE },
    { key: "source", role: "source", label: "Source Language", sample: "en" },
    { key: "target", role: "target", label: "Target Language", sample: "tw" },
    { key: "api_name", role: "provider", label: "Provider", sample: "ghananlp" },
  ],
}

export function isBodyFieldRole(value: string): value is BodyFieldRole {
  return (BODY_FIELD_ROLES as readonly string[]).includes(value)
}

export function humanizeFieldKey(key: string) {
  const cleaned = key.replace(/[_-]+/g, " ").trim()
  if (!cleaned) return "Field"
  return cleaned.replace(/\b\w/g, (letter) => letter.toUpperCase())
}

export function inferFieldRole(key: string): BodyFieldRole {
  const normalized = key.toLowerCase().replace(/[^a-z0-9]/g, "")
  if (["text", "input", "inputtext", "q", "query", "content", "prompt"].includes(normalized)) {
    return "text"
  }
  if (["source", "from", "src", "sourcelang", "sourcelanguage"].includes(normalized)) {
    return "source"
  }
  if (["target", "to", "dest", "targetlang", "targetlanguage"].includes(normalized)) {
    return "target"
  }
  if (["apiname", "provider", "model"].includes(normalized)) return "provider"
  return "custom"
}

export function isAuthFieldKey(key: string) {
  return AUTH_KEY_NAMES.has(key.toLowerCase().replace(/[^a-z0-9_]/g, ""))
}

function sampleFromValue(value: unknown): string {
  if (typeof value === "string") return value
  if (typeof value === "number" || typeof value === "boolean") return String(value)
  if (value == null) return ""
  return JSON.stringify(value)
}

export function fieldsFromSampleJson(
  record: Record<string, unknown>,
): { fields: BodyField[]; authKey?: string } {
  const seen = new Set<string>()
  const usedRoles = new Set<BodyFieldRole>()
  const fields: BodyField[] = []
  let authKey: string | undefined

  for (const [rawKey, value] of Object.entries(record)) {
    const key = rawKey.trim()
    if (!key || seen.has(key)) continue
    seen.add(key)
    if (isAuthFieldKey(key)) {
      authKey ??= key
      continue
    }
    const inferred = inferFieldRole(key)
    const role =
      inferred !== "custom" && !usedRoles.has(inferred) ? inferred : ("custom" as const)
    if (role !== "custom") usedRoles.add(role)
    const known = HUNIKI_SHAPE.fields.find((field) => field.key === key)
    fields.push({
      key,
      role: known?.role ?? role,
      label: known?.label ?? humanizeFieldKey(key),
      sample: sampleFromValue(value),
    })
  }

  return { fields, authKey }
}

export function valuesFromShape(shape: TranslateShape = HUNIKI_SHAPE): FieldValues {
  const values: FieldValues = {}
  for (const field of shape.fields) {
    values[field.key] = field.sample
    values[field.role] = field.sample
  }
  return values
}

export const HUNIKI_LANGUAGE_PAIRS = HUNIKI_LANGUAGES.flatMap((source) =>
  HUNIKI_LANGUAGES.map((target) => ({ source: source.code, target: target.code })),
)

export function valuesForLanguagePair(
  values: FieldValues,
  fields: readonly BodyField[],
  pair: { source: string; target: string },
): FieldValues {
  const next = { ...values }
  for (const field of fields) {
    if (field.role === "source") next[field.key] = pair.source
    if (field.role === "target") next[field.key] = pair.target
  }
  return next
}

export function compileTranslateBody(
  shape: TranslateShape,
  values: FieldValues,
  apiKey?: string,
  authKey = "api_key",
): string {
  const body: Record<string, string> = {}
  for (const field of shape.fields) {
    const raw = (values[field.key] ?? values[field.role] ?? "").trim()
    body[field.key] = field.role === "provider" ? (raw || field.sample || "ghananlp").toLowerCase() : raw
  }
  const key = apiKey?.trim()
  if (key) body[authKey] = key
  return JSON.stringify(body, null, 2)
}

export function inferDefaults(): EndpointDefaults {
  return {
    method: "POST",
    authKind: "body",
    headerName: "api_key",
    bodyKind: "translate",
    shape: HUNIKI_SHAPE,
  }
}

export function isHunikiProvider(value: string): value is HunikiProvider {
  return HUNIKI_PROVIDERS.some((item) => item.value === value)
}
