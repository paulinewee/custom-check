import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import { PRACTICE_STORAGE_KEY, PRACTICE_TOKEN } from "@/lib/practice/config"

vi.mock("next/link", () => ({
  default: ({
    href,
    children,
    ...props
  }: React.AnchorHTMLAttributes<HTMLAnchorElement> & { href: string }) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}))

import { ConfigurePractice } from "./configure-practice"

describe("ConfigurePractice", () => {
  beforeEach(() => {
    window.localStorage.clear()
    document.cookie = `${PRACTICE_STORAGE_KEY}=; Path=/; Max-Age=0`
    Object.defineProperty(window, "location", {
      configurable: true,
      value: { ...window.location, origin: "http://localhost:3000" },
    })
  })

  afterEach(() => {
    window.localStorage.clear()
  })

  it("shows the practice URL and a link to Overview", async () => {
    render(<ConfigurePractice />)

    expect(
      await screen.findByRole("heading", { name: "Configure Test Endpoint" }),
    ).toBeInTheDocument()
    expect(screen.getByText("http://localhost:3000/api/practice/v2/translate")).toBeInTheDocument()
    expect(screen.getByRole("link", { name: "Test on Overview" })).toHaveAttribute(
      "href",
      "/?url=http%3A%2F%2Flocalhost%3A3000%2Fapi%2Fpractice%2Fv2%2Ftranslate",
    )
    expect(screen.getByRole("textbox", { name: "Accepted token" })).toHaveValue(PRACTICE_TOKEN)
  })

  it("persists a toggle so the next request can fail authentication", async () => {
    const user = userEvent.setup()
    render(<ConfigurePractice />)

    const auth = await screen.findByRole("switch", { name: "Authentication" })
    expect(auth).toHaveAttribute("aria-checked", "true")
    await user.click(auth)
    expect(auth).toHaveAttribute("aria-checked", "false")

    const stored = JSON.parse(window.localStorage.getItem(PRACTICE_STORAGE_KEY) ?? "{}")
    expect(stored.authenticated).toBe(false)
  })
})
