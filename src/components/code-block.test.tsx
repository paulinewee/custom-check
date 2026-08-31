import { render } from "@testing-library/react"
import { describe, expect, it } from "vitest"

import { CodeBlock, highlightCurl, highlightJson } from "./code-block"

describe("highlightJson", () => {
  it("marks keys, strings, numbers, and keywords", () => {
    const parts = highlightJson('{\n  "in": "Hello",\n  "ok": true\n}')
    expect(parts).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ className: "text-violet-800 dark:text-violet-300", text: '"in"' }),
        expect.objectContaining({ className: "text-emerald-800 dark:text-emerald-400", text: '"Hello"' }),
        expect.objectContaining({ className: "text-rose-800 dark:text-rose-400", text: "true" }),
      ]),
    )
  })
})

describe("highlightCurl", () => {
  it("marks the command, flags, method, headers, and JSON body", () => {
    const parts = highlightCurl(`curl -X POST 'https://example.com/v1/translate' \\
  -H 'Content-Type: application/json' \\
  -d '{
  "in": "Hello"
}'`)
    expect(parts).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ className: "text-sky-800 dark:text-sky-400", text: "curl" }),
        expect.objectContaining({ className: "text-amber-800 dark:text-amber-400", text: "-X" }),
        expect.objectContaining({ className: "text-rose-800 dark:text-rose-400", text: "POST" }),
        expect.objectContaining({
          className: "text-emerald-800 dark:text-emerald-400",
          text: "'https://example.com/v1/translate'",
        }),
        expect.objectContaining({ className: "text-violet-800 dark:text-violet-300", text: "Content-Type" }),
        expect.objectContaining({ className: "text-violet-800 dark:text-violet-300", text: '"in"' }),
        expect.objectContaining({ className: "text-emerald-800 dark:text-emerald-400", text: '"Hello"' }),
      ]),
    )
  })
})

describe("CodeBlock", () => {
  it("renders JSON so the full text stays readable", () => {
    render(<CodeBlock code={'{\n  "translatedText": "Agoo"\n}'} />)
    expect(document.querySelector("pre code")?.textContent).toContain('"translatedText": "Agoo"')
  })

  it("color-codes a curl command", () => {
    render(<CodeBlock code={"curl -X POST 'https://example.com'"} />)
    expect(document.querySelector(".text-sky-800")?.textContent).toBe("curl")
    expect(document.querySelector("pre")?.textContent).toContain("curl -X POST")
  })
})
