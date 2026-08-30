import { describe, expect, it } from "vitest"

import { RUN_TIMEOUT_MAX_MS } from "./constants"
import {
  firstCustomizeError,
  validateContentType,
  validateLanguageCode,
  validateLatencyMs,
  validateRequestForm,
  validateSecret,
  validateTranslateText,
} from "./validate-form"

describe("validateSecret", () => {
  it("requires a token", () => {
    expect(validateSecret("")).toMatch(/Enter an API key/)
    expect(validateSecret("   ")).toMatch(/Enter an API key/)
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
    { key: "text", role: "text" as const, label: "Input", sample: "Hello" },
    { key: "source", role: "source" as const, label: "Source Language", sample: "en" },
    { key: "target", role: "target" as const, label: "Target Language", sample: "tw" },
    { key: "api_name", role: "provider" as const, label: "Provider", sample: "ghananlp" },
  ]
  const base = {
    method: "POST" as const,
    bodyKind: "translate" as const,
    fields,
    values: { text: "Hello", source: "en", target: "tw", provider: "ghananlp" },
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

  it("skips body checks for GET", () => {
    const next = validateRequestForm({
      ...base,
      method: "GET",
      values: { ...base.values, text: "" },
    })
    expect(next.errors.text).toBeUndefined()
    expect(next.firstId).toBeNull()
  })

  it("ignores latency when finding the first customize error", () => {
    const next = validateRequestForm({ ...base, latencyMs: "0" })
    expect(next.firstId).toBe("latency")
    expect(firstCustomizeError(next.errors)).toBeNull()
  })

  it("allows a pair-count above the usual request cap", () => {
    const next = validateRequestForm({
      ...base,
      requestCount: "400",
      allLanguagePairs: true,
    })
    expect(next.errors.count).toBeUndefined()
    expect(validateRequestForm({ ...base, requestCount: "400" }).errors.count).toMatch(
      /20 requests or fewer/,
    )
  })
})
