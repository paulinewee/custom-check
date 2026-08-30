import { parseJson } from "@/lib/probe/assert"

export type LanguageOption = {
  code: string
  name: string
}

const LANGUAGE_CODE = /^[a-z]{2,3}([_-][A-Za-z]{2,8})?$/i
const LANGUAGE_PAIR = /^[a-z]{2,3}-[a-z]{2,3}$/i
const NESTED_KEYS = ["languages", "translation", "data", "supported_languages", "result"]

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null
}

export function inferLanguagesUrl(endpoint: string): string | null {
  try {
    const parsed = new URL(endpoint)
    const parts = parsed.pathname.split("/").filter(Boolean)
    const versionIndex = parts.findIndex((part) => /^v\d+$/i.test(part))
    parsed.pathname =
      versionIndex >= 0
        ? `/${[...parts.slice(0, versionIndex + 1), "languages"].join("/")}`
        : "/languages"
    parsed.search = ""
    parsed.hash = ""
    return parsed.toString()
  } catch {
    return null
  }
}

function looksLikeLanguageCode(code: string): boolean {
  return LANGUAGE_CODE.test(code)
}

function looksLikePair(code: string): boolean {
  return LANGUAGE_PAIR.test(code)
}

function uniqueOptions(options: LanguageOption[]): LanguageOption[] {
  const seen = new Set<string>()
  return options
    .filter((item) => {
      const code = item.code.trim()
      if (!code || seen.has(code)) return false
      seen.add(code)
      return true
    })
    .map((item) => ({ code: item.code.trim(), name: item.name.trim() || item.code.trim() }))
    .sort((a, b) => a.name.localeCompare(b.name) || a.code.localeCompare(b.code))
}

function collectLanguageOptions(value: unknown): LanguageOption[] {
  if (Array.isArray(value)) {
    return value.flatMap((item) => {
      if (typeof item === "string" && looksLikeLanguageCode(item)) {
        return [{ code: item, name: item }]
      }
      const rec = asRecord(item)
      if (!rec) return []
      const code = String(rec.code ?? rec.id ?? rec.language_code ?? rec.iso ?? rec.lang ?? "")
      const name = String(rec.name ?? rec.language ?? rec.label ?? rec.title ?? code)
      return code ? [{ code, name }] : []
    })
  }

  const rec = asRecord(value)
  if (!rec) return []

  for (const key of NESTED_KEYS) {
    if (key in rec) {
      const nested = collectLanguageOptions(rec[key])
      if (nested.length) return nested
    }
  }

  const entries = Object.entries(rec)
  if (entries.length && entries.every(([, name]) => typeof name === "string")) {
    return entries
      .filter(([code]) => looksLikeLanguageCode(code))
      .map(([code, name]) => ({ code, name: name as string }))
  }

  return []
}

export function parseLanguages(body: string): LanguageOption[] {
  const json = parseJson(body)
  if (json === undefined) return []
  return uniqueOptions(collectLanguageOptions(json))
}

export function languagePairOptions(languages: LanguageOption[]): LanguageOption[] {
  const ready = languages.filter((item) => looksLikePair(item.code))
  if (ready.length && ready.length === languages.length) return ready

  const codes = languages.filter((item) => !looksLikePair(item.code))
  if (codes.length < 2) return ready

  if (codes.length > 20) {
    const english = codes.find((item) => /^(en|eng)(_|$)/i.test(item.code)) ?? codes[0]
    return uniqueOptions(
      codes
        .filter((item) => item.code !== english.code)
        .flatMap((item) => [
          { code: `${english.code}-${item.code}`, name: `${english.name} → ${item.name}` },
          { code: `${item.code}-${english.code}`, name: `${item.name} → ${english.name}` },
        ]),
    )
  }

  const pairs: LanguageOption[] = []
  for (const source of codes) {
    for (const target of codes) {
      if (source.code === target.code) continue
      pairs.push({
        code: `${source.code}-${target.code}`,
        name: `${source.name} → ${target.name}`,
      })
    }
  }
  return uniqueOptions(pairs)
}
