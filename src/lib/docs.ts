import {
  DEFAULT_GAP_MS,
  DEFAULT_LATENCY_MS,
  MAX_REQUESTS,
  TRANSLATE_ENDPOINT,
} from "@/lib/probe/constants"
import { compileTranslateBody, inferDefaults, valuesFromShape } from "@/lib/probe/defaults"
import { inferLanguagesUrl } from "@/lib/probe/languages"

export const DOC_SECTIONS = [
  { id: "how-a-check-works", title: "How a check works" },
  { id: "ghananlp-api-shape", title: "GhanaNLP API shape" },
  { id: "languages", title: "Languages" },
  { id: "authentication", title: "Authentication" },
  { id: "test-api", title: "The test API" },
  { id: "customize-fields", title: "Customize fields" },
  { id: "multiple-checks", title: "Sending multiple checks" },
  { id: "results", title: "What comes back" },
] as const

export type DocSection = (typeof DOC_SECTIONS)[number]

const ghana = inferDefaults(TRANSLATE_ENDPOINT)
const sampleValues = valuesFromShape(ghana.shape)

export const DOCS = {
  translateUrl: TRANSLATE_ENDPOINT,
  languagesUrl: inferLanguagesUrl(TRANSLATE_ENDPOINT) ?? "",
  headerName: ghana.headerName,
  method: "POST" as const,
  sampleBody: compileTranslateBody(ghana.shape, sampleValues),
  sampleInput: sampleValues.text,
  sampleSource: sampleValues.source,
  sampleTarget: sampleValues.target,
  sampleLang: `${sampleValues.source}-${sampleValues.target}`,
  testApiPath: "/api/test",
  defaultLatencyMs: DEFAULT_LATENCY_MS,
  defaultGapMs: DEFAULT_GAP_MS,
  maxRequests: MAX_REQUESTS,
  fields: ghana.shape.fields,
}
