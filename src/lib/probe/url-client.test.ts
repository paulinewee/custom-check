import { describe, expect, it } from "vitest"

import { parseEndpointUrl, validateEndpointUrl } from "./url-client"

describe("validateEndpointUrl", () => {
  it("requires a value", () => {
    expect(validateEndpointUrl("")).toBe("Enter an http(s) endpoint.")
    expect(validateEndpointUrl("   ")).toBe("Enter an http(s) endpoint.")
  })

  it("rejects non-URLs", () => {
    expect(validateEndpointUrl("not-a-url")).toBe(
      "That is not a valid URL. Enter a full address starting with http:// or https://.",
    )
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
    expect(validateEndpointUrl("http://localhost:3000/api/practice/v2/translate")).toBeNull()
    expect(parseEndpointUrl("http://127.0.0.1:3000/api/practice/v2/languages")?.pathname).toBe(
      "/api/practice/v2/languages",
    )
  })
})
