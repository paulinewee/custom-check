import { render, screen } from "@testing-library/react"
import { describe, expect, it } from "vitest"

import { DocsArticle } from "@/components/docs-article"
import { DocsToc } from "@/components/docs-toc"
import { DOC_SECTIONS, DOCS } from "@/lib/docs"

describe("Documentation", () => {
  it("explains the GhanaNLP shape and the test API", () => {
    render(<DocsArticle />)

    expect(screen.getByRole("heading", { level: 1, name: "Documentation" })).toBeInTheDocument()
    expect(screen.getByRole("heading", { name: "How a check works" })).toHaveAttribute(
      "id",
      "how-a-check-works",
    )
    expect(screen.getAllByText(DOCS.translateUrl).length).toBeGreaterThan(0)
    expect(screen.getAllByText(DOCS.headerName).length).toBeGreaterThan(0)
    expect(screen.getAllByText(DOCS.testApiPath).length).toBeGreaterThan(0)
    expect(document.querySelector("pre")?.textContent).toContain('"in": "Hello"')
    expect(document.querySelector("pre")?.textContent).toContain('"lang": "en-tw"')
  })

  it("lists every section in the table of contents", () => {
    render(<DocsToc sections={DOC_SECTIONS} />)

    expect(screen.getByRole("navigation", { name: "On this page" })).toBeInTheDocument()
    for (const section of DOC_SECTIONS) {
      expect(screen.getByRole("link", { name: section.title })).toHaveAttribute(
        "href",
        `#${section.id}`,
      )
    }
  })
})
