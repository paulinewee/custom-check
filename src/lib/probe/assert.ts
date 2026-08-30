import type { Assertion } from "@/lib/probe/types"

const OUTPUT_KEYS = [
  "translation",
  "translated_text",
  "translatedText",
  "text",
  "transcribedText",
  "transcript",
  "output",
  "result",
]

function readPath(value: unknown, path: string): unknown {
  const clean = path.replace(/^\$\.?/, "")
  if (!clean) return value
  return clean.split(".").reduce<unknown>((current, key) => {
    if (current && typeof current === "object" && key in current) {
      return (current as Record<string, unknown>)[key]
    }
    return undefined
  }, value)
}

export function parseJson(body: string): unknown | undefined {
  try {
    return JSON.parse(body)
  } catch {
    return undefined
  }
}

export function evaluateAssertion(body: string, assertion: Assertion): boolean {
  const json = parseJson(body)
  const value = json === undefined ? undefined : readPath(json, assertion.path)
  if (assertion.kind === "exists") return value !== undefined && value !== null
  if (typeof value === "string") return value.trim().length > 0
  if (Array.isArray(value)) return value.length > 0
  return value !== undefined && value !== null && value !== ""
}

export function suggestAssertions(body: string): Assertion[] {
  const json = parseJson(body)
  if (!json || typeof json !== "object" || Array.isArray(json)) return []

  const record = json as Record<string, unknown>
  const suggestions: Assertion[] = []

  for (const key of OUTPUT_KEYS) {
    if (key in record) {
      suggestions.push({
        path: key,
        kind: typeof record[key] === "string" ? "nonempty" : "exists",
      })
    }
  }

  if (suggestions.length === 0) {
    const stringKey = Object.keys(record).find((key) => typeof record[key] === "string")
    if (stringKey) suggestions.push({ path: stringKey, kind: "nonempty" })
  }

  return suggestions.slice(0, 2)
}

export function collectShape(body: string): string[] {
  const json = parseJson(body)
  if (!json || typeof json !== "object") return []
  return Object.keys(json as Record<string, unknown>).sort()
}

export function describeShapeChange(previous: string[], next: string[]): string | undefined {
  if (previous.length === 0 || next.length === 0) return undefined
  const missing = previous.filter((key) => !next.includes(key))
  const added = next.filter((key) => !previous.includes(key))
  if (missing.length === 0 && added.length === 0) return undefined
  const parts: string[] = []
  if (missing.length) parts.push(`${missing.join(", ")} field is missing`)
  if (added.length) parts.push(`new field ${added.join(", ")}`)
  return `Response changed: ${parts.join("; ")}.`
}
