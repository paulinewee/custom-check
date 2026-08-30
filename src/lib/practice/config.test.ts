import { describe, expect, it } from "vitest"

import {
  defaultPracticeConfig,
  isPracticeEndpoint,
  parsePracticeConfig,
  parsePracticeCookie,
  PRACTICE_COOKIE,
  PRACTICE_TOKEN,
  practiceTranslateUrl,
  serializePracticeCookie,
} from "./config"

describe("isPracticeEndpoint", () => {
  it("accepts the practice translate and languages paths on any host", () => {
    expect(isPracticeEndpoint("http://localhost:3000/api/practice/v2/translate")).toBe(true)
    expect(isPracticeEndpoint("https://example.com/api/practice/v2/languages")).toBe(true)
    expect(isPracticeEndpoint("http://127.0.0.1:3000/api/practice/v2/translate/")).toBe(true)
  })

  it("rejects GhanaNLP and other local paths", () => {
    expect(isPracticeEndpoint("https://translation-api.ghananlp.org/v2/translate")).toBe(false)
    expect(isPracticeEndpoint("http://localhost/v2/translate")).toBe(false)
    expect(isPracticeEndpoint("not-a-url")).toBe(false)
  })
})

describe("parsePracticeConfig", () => {
  it("fills defaults and keeps a custom token", () => {
    expect(parsePracticeConfig(null)).toEqual(defaultPracticeConfig())
    expect(parsePracticeConfig({ authenticated: false, token: " other-key " })).toEqual({
      ...defaultPracticeConfig(),
      authenticated: false,
      token: "other-key",
    })
  })
})

describe("practice cookie", () => {
  it("round-trips through a Cookie header", () => {
    const config = { ...defaultPracticeConfig(), reachable: false, token: "lab-key" }
    const header = serializePracticeCookie(config)
    expect(header).toContain(`${PRACTICE_COOKIE}=`)
    expect(parsePracticeCookie(header.split(";")[0])).toEqual(config)
  })

  it("returns defaults when the cookie is missing", () => {
    expect(parsePracticeCookie(null).token).toBe(PRACTICE_TOKEN)
  })
})

describe("practiceTranslateUrl", () => {
  it("joins origin and path", () => {
    expect(practiceTranslateUrl("http://localhost:3000/")).toBe(
      "http://localhost:3000/api/practice/v2/translate",
    )
  })
})
