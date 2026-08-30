import { describe, expect, it } from "vitest"

import { RUN_TIMEOUT_MAX_MS } from "./constants"
import {
  validateContentType,
  validateJsonBody,
  validateLangPair,
  validateLanguageCode,
  validateLatencyMs,
  validateRequestForm,
  validateSecret,
  validateTranslateText,
} from "./validate-form"

describe("validateSecret", () => {
  it("requires a token", () => {
    expect(validateSecret("")).toMatch(/Enter an authentication token/)
    expect(validateSecret("   ")).toMatch(/Enter an authentication token/)
  })

  it("accepts a non-empty token", () => {
    expect(validateSecret("tok_live")).toBeNull()
  })
})

describe("validateTranslateText", () => {
  it("requires text", () => {
    expect(validateTranslateText("")).toMatch(/Enter the text to send/)
  })

  it("accepts a phrase", () => {
    expect(validateTranslateText("Hello")).toBeNull()
  })
})

describe("validateLangPair", () => {
  it("requires a pair", () => {
    expect(validateLangPair("")).toMatch(/lang pair/)
    expect(validateLangPair("en")).toMatch(/not valid/)
  })

  it("accepts a source-target pair", () => {
    expect(validateLangPair("en-tw")).toBeNull()
    expect(validateLangPair("zh-Hans")).toBeNull()
  })
})

describe("validateLanguageCode", () => {
  it("requires a code", () => {
    expect(validateLanguageCode("", "source")).toMatch(/source language code/)
    expect(validateLanguageCode("", "target")).toMatch(/target language code/)
  })

  it("rejects symbols", () => {
    expect(validateLanguageCode("e!", "source")).toMatch(/not valid/)
  })

  it("accepts short and locale codes", () => {
    expect(validateLanguageCode("en", "source")).toBeNull()
    expect(validateLanguageCode("tw", "target")).toBeNull()
    expect(validateLanguageCode("gaa", "source")).toBeNull()
    expect(validateLanguageCode("zh-Hans", "target")).toBeNull()
  })
})

describe("validateJsonBody", () => {
  it("requires a body", () => {
    expect(validateJsonBody("")).toMatch(/Enter a JSON body/)
  })

  it("rejects invalid JSON", () => {
    expect(validateJsonBody("{")).toMatch(/not valid JSON/)
  })

  it("accepts an object", () => {
    expect(validateJsonBody('{"in":"Hello","lang":"en-tw"}')).toBeNull()
  })
})

describe("validateContentType", () => {
  it("requires a media type", () => {
    expect(validateContentType("")).toMatch(/Enter a Content-Type/)
    expect(validateContentType("json")).toMatch(/not a valid media type/)
  })

  it("accepts application/json with parameters", () => {
    expect(validateContentType("application/json")).toBeNull()
    expect(validateContentType("application/json; charset=utf-8")).toBeNull()
  })
})

describe("validateLatencyMs", () => {
  it("requires a whole number in range", () => {
    expect(validateLatencyMs("")).toMatch(/milliseconds before a response is too slow/)
    expect(validateLatencyMs("2.5")).toMatch(/whole number/)
    expect(validateLatencyMs("0")).toMatch(/at least 1/)
    expect(validateLatencyMs(String(RUN_TIMEOUT_MAX_MS + 1))).toMatch(/or less/)
  })

  it("accepts the default threshold", () => {
    expect(validateLatencyMs("2000")).toBeNull()
  })
})

describe("validateRequestForm", () => {
  const fields = [
    { key: "in", role: "text" as const, label: "Input", sample: "Hello", tip: "" },
    { key: "source", role: "source" as const, label: "Source Language", sample: "en", tip: "" },
    { key: "target", role: "target" as const, label: "Target Language", sample: "tw", tip: "" },
  ]
  const base = {
    method: "POST" as const,
    bodyKind: "translate" as const,
    fields,
    rawMode: false,
    values: { text: "Hello", source: "en", target: "tw", lang: "" },
    rawBody: "",
    defaultBody: '{"in":"Hello","lang":"en-tw"}',
    contentType: "application/json",
    latencyMs: "2000",
  }

  it("returns no errors for a known-good request", () => {
    expect(validateRequestForm(base).firstId).toBeNull()
  })

  it("points at the first invalid structured field", () => {
    const next = validateRequestForm({
      ...base,
      values: { ...base.values, text: "", source: "!!" },
    })
    expect(next.firstId).toBe("text")
    expect(next.errors.text).toMatch(/text to send/)
    expect(next.errors.source).toMatch(/not valid/)
  })

  it("validates raw JSON instead of structured fields", () => {
    const next = validateRequestForm({ ...base, rawMode: true, rawBody: "{" })
    expect(next.firstId).toBe("raw-body")
    expect(next.errors.text).toBeUndefined()
  })

  it("skips body checks for GET", () => {
    const next = validateRequestForm({
      ...base,
      method: "GET",
      values: { ...base.values, text: "" },
    })
    expect(next.errors.text).toBeUndefined()
    expect(next.firstId).toBeNull()
  })
})
