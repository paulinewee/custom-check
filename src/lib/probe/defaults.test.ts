import { describe, expect, it } from "vitest"

import {
  compileTranslateBody,
  fieldsFromSampleJson,
  HUNIKI_LANGUAGES,
  HUNIKI_PROVIDERS,
  HUNIKI_LANGUAGE_PAIRS,
  inferDefaults,
  isHunikiProvider,
  valuesForLanguagePair,
  valuesFromShape,
} from "./defaults"

describe("compileTranslateBody", () => {
  it("sends Huniki text, source, target, and api_name", () => {
    const { shape } = inferDefaults()
    expect(JSON.parse(compileTranslateBody(shape, valuesFromShape(shape)))).toEqual({
      text: "The quick brown fox jumps over the lazy dog.",
      source: "en",
      target: "tw",
      api_name: "ghananlp",
    })
    expect(
      JSON.parse(
        compileTranslateBody(
          shape,
          {
            text: "Good morning",
            source: "tw",
            target: "en",
            provider: "lelapa",
          },
          "tok_live",
        ),
      ),
    ).toEqual({
      text: "Good morning",
      source: "tw",
      target: "en",
      api_name: "lelapa",
      api_key: "tok_live",
    })
  })
})

describe("fieldsFromSampleJson", () => {
  it("infers roles and skips auth keys", () => {
    expect(
      fieldsFromSampleJson({
        q: "Hi",
        from: "en",
        to: "tw",
        api_key: "secret",
      }),
    ).toEqual({
      fields: [
        { key: "q", role: "text", label: "Q", sample: "Hi" },
        { key: "from", role: "source", label: "From", sample: "en" },
        { key: "to", role: "target", label: "To", sample: "tw" },
      ],
      authKey: "api_key",
    })
  })
})

describe("HUNIKI_LANGUAGE_PAIRS", () => {
  it("pairs every source language with every target language", () => {
    expect(HUNIKI_LANGUAGE_PAIRS).toHaveLength(HUNIKI_LANGUAGES.length * HUNIKI_LANGUAGES.length)
    expect(HUNIKI_LANGUAGE_PAIRS[0]).toEqual({ source: "en", target: "en" })
    expect(HUNIKI_LANGUAGE_PAIRS[1]).toEqual({ source: "en", target: "tw" })
    expect(HUNIKI_LANGUAGE_PAIRS.at(-1)).toEqual({
      source: HUNIKI_LANGUAGES.at(-1)?.code,
      target: HUNIKI_LANGUAGES.at(-1)?.code,
    })
  })
})

describe("valuesForLanguagePair", () => {
  it("writes source and target field keys", () => {
    const { shape } = inferDefaults()
    expect(
      valuesForLanguagePair(valuesFromShape(shape), shape.fields, { source: "yo", target: "am" }),
    ).toMatchObject({ source: "yo", target: "am" })
  })
})

describe("HUNIKI_PROVIDERS", () => {
  it("lists GhanaNLP, Lelapa, and Lesan only", () => {
    expect(HUNIKI_PROVIDERS.map((item) => item.value)).toEqual(["ghananlp", "lelapa", "lesan"])
    expect(isHunikiProvider("google")).toBe(false)
    expect(isHunikiProvider("microsoft")).toBe(false)
  })
})

describe("inferDefaults", () => {
  it("always uses the Huniki body shape and body auth", () => {
    const defaults = inferDefaults()
    expect(defaults.shape.id).toBe("huniki")
    expect(defaults.authKind).toBe("body")
    expect(defaults.headerName).toBe("api_key")
    expect(defaults.method).toBe("POST")
  })
})
