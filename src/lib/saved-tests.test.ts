import { afterEach, describe, expect, it } from "vitest"

import {
  SAVED_TESTS_KEY,
  readSavedTests,
  testLabel,
  toSavedTest,
  writeSavedTests,
} from "./saved-tests"

const sample = toSavedTest({
  url: "https://example.com/v2/translate",
  method: "POST",
  overall: "healthy",
  title: "Translation succeeded",
  explanation: "The provider returned a usable translation.",
  status: 200,
  durationMs: 120,
})

describe("saved tests", () => {
  afterEach(() => {
    window.localStorage.clear()
  })

  it("labels a URL by host and path", () => {
    expect(testLabel("https://example.com/v2/translate")).toBe("example.com/v2/translate")
  })

  it("round-trips through localStorage without secrets", () => {
    writeSavedTests([sample])
    const stored = JSON.parse(window.localStorage.getItem(SAVED_TESTS_KEY) ?? "[]") as unknown[]
    expect(JSON.stringify(stored)).not.toMatch(/secret|Bearer|eyJ/)
    expect(readSavedTests()).toEqual([sample])
  })

  it("ignores corrupted storage", () => {
    window.localStorage.setItem(SAVED_TESTS_KEY, "{nope")
    expect(readSavedTests()).toEqual([])
  })
})
