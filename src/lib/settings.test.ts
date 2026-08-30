import { describe, expect, it } from "vitest"

import { DEFAULT_INPUT_SAMPLE, HUNIKI_SHAPE } from "@/lib/probe/defaults"

import { applySampleJson, DEFAULT_SETTINGS, parseCheckSettings } from "./settings"

describe("parseCheckSettings", () => {
  it("returns Huniki defaults for empty input", () => {
    expect(parseCheckSettings(null)).toEqual(DEFAULT_SETTINGS)
    expect(parseCheckSettings({}).shape.fields).toEqual(HUNIKI_SHAPE.fields)
  })

  it("upgrades the old Hello sample on the default Huniki shape", () => {
    const next = parseCheckSettings({
      shape: {
        id: "huniki",
        fields: HUNIKI_SHAPE.fields.map((field) =>
          field.role === "text" ? { ...field, sample: "Hello" } : field,
        ),
      },
    })
    expect(next.shape.id).toBe("huniki")
    expect(next.shape.fields.find((field) => field.role === "text")?.sample).toBe(DEFAULT_INPUT_SAMPLE)
  })

  it("keeps a custom shape and auth key", () => {
    const next = parseCheckSettings({
      shape: {
        id: "custom",
        fields: [{ key: "q", role: "text", label: "Query", sample: "Hi" }],
      },
      authKind: "api_key",
      authKey: "x-api-key",
      latencyMs: 1500,
      emptyPath: "data.text",
      flagEmpty: false,
    })
    expect(next.shape.fields).toEqual([{ key: "q", role: "text", label: "Query", sample: "Hi" }])
    expect(next.authKind).toBe("api_key")
    expect(next.authKey).toBe("x-api-key")
    expect(next.latencyMs).toBe(1500)
    expect(next.emptyPath).toBe("data.text")
    expect(next.flagEmpty).toBe(false)
  })
})

describe("applySampleJson", () => {
  it("turns a pasted body into editable fields and skips the token", () => {
    const next = applySampleJson(
      JSON.stringify({
        q: "Good morning",
        from: "en",
        to: "fr",
        api_key: "secret",
      }),
      DEFAULT_SETTINGS,
    )
    expect(next.shape.id).toBe("custom")
    expect(next.shape.fields).toEqual([
      { key: "q", role: "text", label: "Q", sample: "Good morning" },
      { key: "from", role: "source", label: "From", sample: "en" },
      { key: "to", role: "target", label: "To", sample: "fr" },
    ])
    expect(next.authKey).toBe("api_key")
  })

  it("rejects arrays and empty objects", () => {
    expect(() => applySampleJson("[]", DEFAULT_SETTINGS)).toThrow(/JSON object/)
    expect(() => applySampleJson("{}", DEFAULT_SETTINGS)).toThrow(/no fields/)
  })
})
