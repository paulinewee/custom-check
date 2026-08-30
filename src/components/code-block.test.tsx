import { render } from "@testing-library/react"
import { describe, expect, it } from "vitest"

import { CodeBlock, highlightJson } from "./code-block"

describe("highlightJson", () => {
  it("marks keys, strings, numbers, and keywords", () => {
    const parts = highlightJson('{\n  "in": "Hello",\n  "ok": true\n}')
    expect(parts).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ className: "text-violet-300", text: '"in"' }),
        expect.objectContaining({ className: "text-emerald-400", text: '"Hello"' }),
        expect.objectContaining({ className: "text-pink-400", text: "true" }),
      ]),
    )
  })
})

describe("CodeBlock", () => {
  it("renders JSON so the full text stays readable", () => {
    render(<CodeBlock code={'{\n  "translatedText": "Agoo"\n}'} />)
    expect(document.querySelector("pre code")?.textContent).toContain('"translatedText": "Agoo"')
  })
})
