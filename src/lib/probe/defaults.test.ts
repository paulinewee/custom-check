import { describe, expect, it } from "vitest"

import { compileTranslateBody, inferDefaults, valuesFromShape } from "./defaults"

describe("compileTranslateBody", () => {
  it("sends GhanaNLP in and a lang pair from source and target", () => {
    const { shape } = inferDefaults("https://translation-api.ghananlp.org/v2/translate")
    expect(JSON.parse(compileTranslateBody(shape, valuesFromShape(shape)))).toEqual({
      in: "Hello",
      lang: "en-tw",
    })
    expect(
      JSON.parse(
        compileTranslateBody(shape, {
          text: "Good morning",
          source: "tw",
          target: "en",
          lang: "",
        }),
      ),
    ).toEqual({
      in: "Good morning",
      lang: "tw-en",
    })
  })
})

describe("inferDefaults", () => {
  it("treats the practice endpoint as GhanaNLP", () => {
    const defaults = inferDefaults("http://localhost:3000/api/practice/v2/translate")
    expect(defaults.shape.id).toBe("ghana")
    expect(defaults.headerName).toBe("Ocp-Apim-Subscription-Key")
    expect(defaults.method).toBe("POST")
  })
})
