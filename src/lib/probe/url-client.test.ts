import { describe, expect, it } from "vitest"

import { normalizeEndpointUrl, parseEndpointUrl, validateEndpointUrl } from "./url-client"

describe("normalizeEndpointUrl", () => {
  it("adds https for a public host without a scheme", () => {
    expect(normalizeEndpointUrl("api.huniki.ai/translate")).toBe(
      "https://api.huniki.ai/translate",
    )
  })

  it("adds http for localhost without a scheme", () => {
    expect(normalizeEndpointUrl("localhost:3000/api/practice/translate")).toBe(
      "http://localhost:3000/api/practice/translate",
    )
  })

  it("leaves an existing scheme alone", () => {
    expect(normalizeEndpointUrl("https://api.huniki.ai/translate")).toBe(
      "https://api.huniki.ai/translate",
    )
  })
})

describe("validateEndpointUrl", () => {
  it("requires a value", () => {
    expect(validateEndpointUrl("")).toBe("Enter an http(s) endpoint.")
    expect(validateEndpointUrl("   ")).toBe("Enter an http(s) endpoint.")
  })

  it("accepts a host without a scheme", () => {
    expect(validateEndpointUrl("api.huniki.ai/translate")).toBeNull()
    expect(parseEndpointUrl("api.huniki.ai/translate")?.href).toBe(
      "https://api.huniki.ai/translate",
    )
  })

  it("rejects strings that are still not a URL after a scheme is added", () => {
    expect(validateEndpointUrl("hello world")).toMatch(/not a valid URL/)
  })

  it("rejects non-http schemes", () => {
    expect(validateEndpointUrl("ftp://example.com")).toBe(
      "Only http and https endpoints can be tested. Use an http(s) address.",
    )
  })

  it("rejects private hosts", () => {
    expect(validateEndpointUrl("http://localhost/api")).toBe(
      "Private or local hosts cannot be tested. Use a public hostname.",
    )
    expect(validateEndpointUrl("http://127.0.0.1/api")).toBe(
      "Private or local hosts cannot be tested. Use a public hostname.",
    )
  })

  it("accepts public http(s) URLs", () => {
    expect(validateEndpointUrl("https://example.com/v1")).toBeNull()
    expect(parseEndpointUrl("https://example.com/v1")?.host).toBe("example.com")
  })

  it("allows the local practice endpoint", () => {
    expect(validateEndpointUrl("http://localhost:3000/api/practice/translate")).toBeNull()
    expect(validateEndpointUrl("localhost:3000/api/practice/translate")).toBeNull()
    expect(parseEndpointUrl("http://127.0.0.1:3000/api/practice/translate")?.pathname).toBe(
      "/api/practice/translate",
    )
  })
})
