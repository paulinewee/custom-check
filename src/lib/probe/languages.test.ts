import { describe, expect, it } from "vitest"

import { inferLanguagesUrl, languagePairOptions, parseLanguages } from "./languages"

describe("inferLanguagesUrl", () => {
  it("keeps the API version and replaces the operation with /languages", () => {
    expect(inferLanguagesUrl("https://translation-api.ghananlp.org/v2/translate")).toBe(
      "https://translation-api.ghananlp.org/v2/languages",
    )
    expect(inferLanguagesUrl("https://api.lelapa.ai/v1/translate/process")).toBe(
      "https://api.lelapa.ai/v1/languages",
    )
  })

  it("keeps a prefix before the version segment", () => {
    expect(inferLanguagesUrl("http://localhost:3000/api/practice/v2/translate")).toBe(
      "http://localhost:3000/api/practice/v2/languages",
    )
  })

  it("uses /languages on the same host when there is no version", () => {
    expect(inferLanguagesUrl("https://example.com/posts")).toBe("https://example.com/languages")
  })

  it("returns null for an invalid URL", () => {
    expect(inferLanguagesUrl("not-a-url")).toBeNull()
  })
})

describe("parseLanguages", () => {
  it("reads a languages map", () => {
    expect(parseLanguages(JSON.stringify({ languages: { en: "English", tw: "Twi" } }))).toEqual([
      { code: "en", name: "English" },
      { code: "tw", name: "Twi" },
    ])
  })

  it("reads a nested translation map", () => {
    expect(
      parseLanguages(JSON.stringify({ translation: { eng: "English", twi: "Twi" } })),
    ).toEqual([
      { code: "eng", name: "English" },
      { code: "twi", name: "Twi" },
    ])
  })

  it("reads an array of code/name objects", () => {
    expect(
      parseLanguages(JSON.stringify([{ code: "zul_Latn", name: "Zulu" }, { code: "eng_Latn", name: "English" }])),
    ).toEqual([
      { code: "eng_Latn", name: "English" },
      { code: "zul_Latn", name: "Zulu" },
    ])
  })

  it("ignores response objects that are not language lists", () => {
    expect(parseLanguages(JSON.stringify({ translatedText: "Agoo" }))).toEqual([])
    expect(parseLanguages("not json")).toEqual([])
  })
})

describe("languagePairOptions", () => {
  it("builds ordered pairs from language codes", () => {
    expect(
      languagePairOptions([
        { code: "en", name: "English" },
        { code: "tw", name: "Twi" },
      ]),
    ).toEqual([
      { code: "en-tw", name: "English → Twi" },
      { code: "tw-en", name: "Twi → English" },
    ])
  })

  it("keeps values that are already pairs", () => {
    expect(
      languagePairOptions([
        { code: "eng-twi", name: "English to Twi" },
        { code: "twi-eng", name: "Twi to English" },
      ]),
    ).toEqual([
      { code: "eng-twi", name: "English to Twi" },
      { code: "twi-eng", name: "Twi to English" },
    ])
  })
})
