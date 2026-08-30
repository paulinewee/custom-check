import { isPracticeEndpoint } from "@/lib/practice/config"
import type { AuthKind, RequestMethod } from "@/lib/probe/types"

export type BodyKind = "none" | "translate" | "asr"
export type BodyFieldRole = "text" | "source" | "target" | "lang"

export type BodyField = {
  key: string
  role: BodyFieldRole
  label: string
  sample: string
  tip: string
}

export type TranslateShape = {
  id: "ghana" | "vulavula" | "generic"
  fields: readonly BodyField[]
}

export type FieldValues = Record<BodyFieldRole, string>

export type EndpointDefaults = {
  method: RequestMethod
  authKind: AuthKind
  headerName: string
  bodyKind: BodyKind
  shape: TranslateShape
}

const GHANA_SHAPE: TranslateShape = {
  id: "ghana",
  fields: [
    {
      key: "in",
      role: "text",
      label: "Input",
      sample: "Hello",
      tip: "The phrase to translate, such as Hello.",
    },
    {
      key: "source",
      role: "source",
      label: "Source Language",
      sample: "en",
      tip: "Language of the input. Combined with the target as lang, such as en-tw.",
    },
    {
      key: "target",
      role: "target",
      label: "Target Language",
      sample: "tw",
      tip: "Language to translate into. Combined with the source as lang, such as en-tw.",
    },
  ],
}

const VULAVULA_SHAPE: TranslateShape = {
  id: "vulavula",
  fields: [
    {
      key: "input_text",
      role: "text",
      label: "Input",
      sample: "Hello",
      tip: "The text to translate. Vulavula recommends fewer than 100 words.",
    },
    {
      key: "source_lang",
      role: "source",
      label: "Source Language",
      sample: "eng_Latn",
      tip: "Language of the input, such as eng_Latn or zul_Latn.",
    },
    {
      key: "target_lang",
      role: "target",
      label: "Target Language",
      sample: "zul_Latn",
      tip: "Language to translate into, such as zul_Latn or eng_Latn.",
    },
  ],
}

const GENERIC_SHAPE: TranslateShape = {
  id: "generic",
  fields: [
    {
      key: "text",
      role: "text",
      label: "Input",
      sample: "Hello",
      tip: "The phrase we send as text, such as Hello.",
    },
    {
      key: "source_language",
      role: "source",
      label: "Source Language",
      sample: "en",
      tip: "The language you start from. Sent as source_language.",
    },
    {
      key: "target_language",
      role: "target",
      label: "Target Language",
      sample: "fr",
      tip: "The language you want back. Sent as target_language.",
    },
  ],
}

const EMPTY_VALUES: FieldValues = {
  text: "",
  source: "",
  target: "",
  lang: "",
}

export function valuesFromShape(shape: TranslateShape): FieldValues {
  const values = { ...EMPTY_VALUES }
  for (const field of shape.fields) {
    values[field.role] = field.sample
  }
  return values
}

export function compileTranslateBody(shape: TranslateShape, values: FieldValues): string {
  if (shape.id === "ghana") {
    return JSON.stringify(
      {
        in: values.text.trim(),
        lang: `${values.source.trim()}-${values.target.trim()}`,
      },
      null,
      2,
    )
  }

  const body: Record<string, string> = {}
  for (const field of shape.fields) {
    body[field.key] = values[field.role].trim()
  }
  return JSON.stringify(body, null, 2)
}

export function translateBodyKeys(shape: TranslateShape): string[] {
  if (shape.id === "ghana") return ["in", "lang"]
  return shape.fields.map((field) => field.key)
}

export function inferDefaults(url: string): EndpointDefaults {
  let path = ""
  let host = ""
  try {
    const parsed = new URL(url)
    path = parsed.pathname.toLowerCase()
    host = parsed.hostname.toLowerCase()
  } catch {
    path = url.toLowerCase()
    host = url.toLowerCase()
  }

  const ghana = host.includes("ghananlp") || host.includes("khaya") || isPracticeEndpoint(url)
  const vulavula = host.includes("lelapa") || host.includes("vulavula")
  const asr = /asr|transcribe|stt/.test(path)
  const translate = /translate|translation/.test(path)
  const languages = path.includes("languages")

  return {
    method:
      languages && !translate
        ? "GET"
        : asr || translate || path.includes("/v2/")
          ? "POST"
          : languages
            ? "GET"
            : "POST",
    authKind: "api_key",
    headerName: ghana
      ? "Ocp-Apim-Subscription-Key"
      : vulavula
        ? "X-CLIENT-TOKEN"
        : "X-API-Key",
    bodyKind: asr ? "asr" : translate || (!languages && !asr) ? "translate" : "none",
    shape: ghana ? GHANA_SHAPE : vulavula ? VULAVULA_SHAPE : GENERIC_SHAPE,
  }
}

export function isGhanaHost(url: string): boolean {
  if (isPracticeEndpoint(url)) return true
  try {
    const host = new URL(url).hostname.toLowerCase()
    return host.includes("ghananlp") || host.includes("khaya")
  } catch {
    return url.toLowerCase().includes("ghananlp")
  }
}
