import { render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import { ProbeApp } from "@/components/probe-app"
import { SavedTestsProvider } from "@/components/saved-tests-context"
import { ThemeProvider } from "@/components/theme-provider"
import { TRANSLATE_ENDPOINT } from "@/lib/probe/constants"
import { SAVED_TESTS_KEY, writeSavedTests, toSavedTest } from "@/lib/saved-tests"

const navigation = vi.hoisted(() => ({ pathname: "/" }))

vi.mock("next/navigation", () => ({
  usePathname: () => navigation.pathname,
}))

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

import { AppSidebar } from "./app-sidebar"

const saved = toSavedTest({
  id: "test-1",
  at: Date.UTC(2026, 7, 30, 12, 0),
  url: TRANSLATE_ENDPOINT,
  method: "POST",
  overall: "healthy",
  title: "Translation succeeded",
  explanation: "The provider returned a usable translation.",
  status: 200,
  durationMs: 120,
})

function renderSidebar() {
  return render(
    <ThemeProvider>
      <SavedTestsProvider>
        <AppSidebar />
      </SavedTestsProvider>
    </ThemeProvider>,
  )
}

describe("AppSidebar", () => {
  beforeEach(() => {
    navigation.pathname = "/"
    window.localStorage.clear()
  })

  afterEach(() => {
    window.localStorage.clear()
    document.documentElement.classList.remove("dark")
    document.documentElement.style.colorScheme = ""
  })

  it("starts minimized with the Custom Check mark", () => {
    renderSidebar()

    expect(screen.getByRole("link", { name: "Custom Check" })).toHaveAttribute("href", "/")
    expect(screen.getByRole("button", { name: "Expand sidebar" })).toHaveAttribute(
      "aria-expanded",
      "false",
    )
    expect(screen.queryByRole("link", { name: "Overview" })).not.toBeInTheDocument()
    expect(screen.queryByRole("heading", { name: "Checks" })).not.toBeInTheDocument()
  })

  it("expands to Custom Check and Overview without an empty checks list", async () => {
    const user = userEvent.setup()
    renderSidebar()

    await user.click(screen.getByRole("button", { name: "Expand sidebar" }))

    expect(screen.getByText("Custom Check")).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Collapse sidebar" })).toHaveAttribute(
      "aria-expanded",
      "true",
    )
    expect(screen.getByRole("link", { name: "Overview" })).toHaveAttribute("aria-current", "page")
    expect(screen.getByRole("link", { name: "Overview" })).not.toHaveClass("font-medium")
    expect(screen.getByRole("link", { name: "Overview" })).toHaveClass("text-foreground")
    expect(screen.getByRole("link", { name: "Documentation" })).toHaveClass("text-muted-foreground")
    expect(screen.getByRole("link", { name: "Configure Test Endpoint" })).toHaveAttribute(
      "href",
      "/configure",
    )
    expect(screen.getByRole("link", { name: "Configure Test Endpoint" })).not.toHaveAttribute(
      "aria-current",
    )
    expect(screen.getByRole("link", { name: "Documentation" })).toHaveAttribute("href", "/docs")
    expect(screen.getByRole("link", { name: "Documentation" })).not.toHaveAttribute("aria-current")
    expect(screen.queryByRole("heading", { name: "Checks" })).not.toBeInTheDocument()
    expect(screen.queryByText(/saved here so you can open them again/)).not.toBeInTheDocument()
  })

  it("does not mark Overview current on another path", async () => {
    navigation.pathname = "/elsewhere"
    const user = userEvent.setup()
    renderSidebar()
    await user.click(screen.getByRole("button", { name: "Expand sidebar" }))

    expect(screen.getByRole("link", { name: "Overview" })).not.toHaveAttribute("aria-current")
  })

  it("marks Configure Test Endpoint current on /configure", async () => {
    navigation.pathname = "/configure"
    const user = userEvent.setup()
    renderSidebar()
    await user.click(screen.getByRole("button", { name: "Expand sidebar" }))

    expect(screen.getByRole("link", { name: "Configure Test Endpoint" })).toHaveAttribute(
      "aria-current",
      "page",
    )
    expect(screen.getByRole("link", { name: "Overview" })).not.toHaveAttribute("aria-current")
  })

  it("marks Documentation current on /docs", async () => {
    navigation.pathname = "/docs"
    const user = userEvent.setup()
    renderSidebar()
    await user.click(screen.getByRole("button", { name: "Expand sidebar" }))

    expect(screen.getByRole("link", { name: "Documentation" })).toHaveAttribute(
      "aria-current",
      "page",
    )
    expect(screen.getByRole("link", { name: "Overview" })).not.toHaveAttribute("aria-current")
  })

  it("lists stored tests and loads one into the form", async () => {
    writeSavedTests([saved])
    const user = userEvent.setup()
    render(
      <ThemeProvider>
        <SavedTestsProvider>
          <AppSidebar />
          <ProbeApp initialUrl="" />
        </SavedTestsProvider>
      </ThemeProvider>,
    )

    await user.click(screen.getByRole("button", { name: "Expand sidebar" }))
    expect(screen.getByRole("heading", { name: "Checks" })).toBeInTheDocument()
    expect(await screen.findByText("translation-api.ghananlp.org/v2/translate")).toBeInTheDocument()
    expect(screen.getByText("Translation succeeded")).toBeInTheDocument()

    await user.click(
      screen.getByRole("button", {
        name: "Open translation-api.ghananlp.org/v2/translate",
      }),
    )

    await waitFor(() => {
      expect(screen.getByRole("textbox", { name: "Endpoint" })).toHaveValue(TRANSLATE_ENDPOINT)
    })
    expect(
      screen.getByRole("heading", { name: /Your endpoint requires an authentication token/ }),
    ).toBeInTheDocument()
  })

  it("removes a stored test", async () => {
    writeSavedTests([saved])
    const user = userEvent.setup()
    renderSidebar()

    await user.click(screen.getByRole("button", { name: "Expand sidebar" }))
    await user.click(
      await screen.findByRole("button", {
        name: "Remove translation-api.ghananlp.org/v2/translate",
      }),
    )

    expect(screen.queryByRole("heading", { name: "Checks" })).not.toBeInTheDocument()
    expect(JSON.parse(window.localStorage.getItem(SAVED_TESTS_KEY) ?? "[]")).toEqual([])
  })

  it("resizes the sidebar from the drag handle", async () => {
    const user = userEvent.setup()
    renderSidebar()

    const handle = screen.getByRole("slider", { name: "Resize sidebar" })
    expect(handle).toHaveAttribute("aria-valuenow", "56")
    expect(screen.queryByRole("link", { name: "Overview" })).not.toBeInTheDocument()

    handle.focus()
    await user.keyboard("{ArrowRight}")
    expect(screen.getByRole("link", { name: "Overview" })).toBeInTheDocument()
    expect(handle).toHaveAttribute("aria-valuenow", "256")

    await user.keyboard("{End}")
    expect(handle).toHaveAttribute("aria-valuenow", "480")
    expect(window.localStorage.getItem("custom-check.sidebar-width")).toBe("480")

    await user.keyboard("{Home}")
    expect(screen.getByRole("button", { name: "Expand sidebar" })).toBeInTheDocument()
    expect(screen.queryByRole("link", { name: "Overview" })).not.toBeInTheDocument()
    expect(handle).toHaveAttribute("aria-valuenow", "56")

    await user.click(screen.getByRole("button", { name: "Expand sidebar" }))
    expect(handle).toHaveAttribute("aria-valuenow", "480")
  })

  it("shows the theme meter when expanded and the current theme icon when collapsed", async () => {
    const user = userEvent.setup()
    renderSidebar()

    expect(screen.getByRole("button", { name: "Dark" })).toBeInTheDocument()
    expect(screen.queryByRole("radiogroup", { name: "Theme" })).not.toBeInTheDocument()
    expect(screen.queryByRole("button", { name: "Account" })).not.toBeInTheDocument()

    await user.click(screen.getByRole("button", { name: "Expand sidebar" }))
    expect(screen.getByRole("radiogroup", { name: "Theme" })).toBeInTheDocument()
    expect(screen.getByText("Theme")).toBeInTheDocument()
    expect(screen.getByRole("radio", { name: "Dark" })).toHaveAttribute("aria-checked", "true")
    expect(screen.queryByText("Pauline Wee")).not.toBeInTheDocument()
    expect(screen.queryByText("PW")).not.toBeInTheDocument()

    await user.click(screen.getByRole("radio", { name: "Light" }))
    expect(screen.getByRole("radio", { name: "Light" })).toHaveAttribute("aria-checked", "true")
    expect(document.documentElement).not.toHaveClass("dark")
    expect(window.localStorage.getItem("custom-check.theme")).toBe("light")

    await user.click(screen.getByRole("button", { name: "Collapse sidebar" }))
    expect(screen.queryByRole("radiogroup", { name: "Theme" })).not.toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Light" })).toBeInTheDocument()
  })
})
