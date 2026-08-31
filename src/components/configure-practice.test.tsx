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

  it("shows the practice URL and a link to Home", async () => {
    render(<ConfigurePractice />)

    expect(await screen.findByRole("heading", { name: "Test Endpoint", level: 1 })).toBeInTheDocument()
    expect(
      screen.getByText("Use this endpoint for testing in lieu of a live API service."),
    ).toBeInTheDocument()
    expect(screen.getByRole("heading", { name: "Test Endpoint", level: 2 })).toBeInTheDocument()
    expect(screen.getByRole("heading", { name: "Test Conditions" })).toBeInTheDocument()
    expect(screen.getByRole("heading", { name: "Test Authentication Token" })).toBeInTheDocument()
    expect(screen.queryByText(/Same path and body as Huniki/)).not.toBeInTheDocument()
    expect(screen.queryByText(/Paste this on Overview/)).not.toBeInTheDocument()
    expect(screen.getByText("http://localhost:3000/api/practice/translate")).toBeInTheDocument()
    expect(screen.getByRole("link", { name: "Test" })).toHaveAttribute(
      "href",
      "/?url=http%3A%2F%2Flocalhost%3A3000%2Fapi%2Fpractice%2Ftranslate",
    )
    expect(screen.getByRole("textbox", { name: "Test Authentication Token" })).toHaveValue(
      PRACTICE_TOKEN,
    )
  })

  it("persists a toggle so the next request can fail authentication", async () => {
    const user = userEvent.setup()
    render(<ConfigurePractice />)

    const auth = await screen.findByRole("switch", { name: "Authentication succeeds." })
    expect(auth).toHaveAttribute("aria-checked", "true")
    await user.click(auth)
    expect(auth).toHaveAttribute("aria-checked", "false")

    const stored = JSON.parse(window.localStorage.getItem(PRACTICE_STORAGE_KEY) ?? "{}")
    expect(stored.authenticated).toBe(false)
  })
})
