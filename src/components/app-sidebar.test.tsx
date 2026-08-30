import { render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import { ProbeApp } from "@/components/probe-app"
import { SavedTestsProvider } from "@/components/saved-tests-context"
import { ThemeProvider } from "@/components/theme-provider"
import { TRANSLATE_ENDPOINT } from "@/lib/probe/constants"
import { writeSavedTests, toSavedTest } from "@/lib/saved-tests"

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

  it("starts expanded with a sidebar toggle", () => {
    renderSidebar()

    expect(screen.getByText("Custom Check")).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Collapse sidebar" })).toHaveAttribute(
      "aria-expanded",
      "true",
    )
    expect(screen.getByRole("link", { name: "Home" })).toBeInTheDocument()
  })

  it("shows Custom Check and Home without an empty checks list", () => {
    renderSidebar()

    expect(screen.getByText("Custom Check")).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Collapse sidebar" })).toHaveAttribute(
      "aria-expanded",
      "true",
    )
    expect(screen.getByRole("link", { name: "Home" })).toHaveAttribute("aria-current", "page")
    expect(screen.getByRole("link", { name: "Home" })).not.toHaveClass("font-medium")
    expect(screen.getByRole("link", { name: "Home" })).toHaveClass("bg-muted", "rounded-lg", "text-foreground")
    expect(screen.getByRole("link", { name: "Settings" })).toHaveClass(
      "rounded-lg",
      "text-muted-foreground",
      "hover:bg-muted/60",
    )
    expect(screen.getByRole("link", { name: "Settings" })).not.toHaveClass("bg-muted")
    expect(screen.getByRole("link", { name: "Test Endpoint" })).toHaveAttribute(
      "href",
      "/configure",
    )
    expect(screen.getByRole("link", { name: "Test Endpoint" })).not.toHaveAttribute(
      "aria-current",
    )
    expect(screen.getByRole("link", { name: "Settings" })).toHaveAttribute("href", "/settings")
    expect(screen.getByRole("link", { name: "Settings" })).not.toHaveAttribute("aria-current")
    expect(screen.queryByRole("heading", { name: "Recents" })).not.toBeInTheDocument()
    expect(screen.queryByText(/saved here so you can open them again/)).not.toBeInTheDocument()
  })

  it("does not mark Home current on another path", () => {
    navigation.pathname = "/elsewhere"
    renderSidebar()

    expect(screen.getByRole("link", { name: "Home" })).not.toHaveAttribute("aria-current")
  })

  it("marks Test Endpoint current on /configure", () => {
    navigation.pathname = "/configure"
    renderSidebar()

    expect(screen.getByRole("link", { name: "Test Endpoint" })).toHaveAttribute(
      "aria-current",
      "page",
    )
    expect(screen.getByRole("link", { name: "Home" })).not.toHaveAttribute("aria-current")
  })

  it("marks Settings current on /settings", () => {
    navigation.pathname = "/settings"
    renderSidebar()

    expect(screen.getByRole("link", { name: "Settings" })).toHaveAttribute("aria-current", "page")
    expect(screen.getByRole("link", { name: "Home" })).not.toHaveAttribute("aria-current")
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

    expect(screen.getByRole("heading", { name: "Recents" })).toBeInTheDocument()
    expect(await screen.findByText("api.huniki.ai/translate")).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Open api.huniki.ai/translate" })).toHaveTextContent(
      "Translation succeeded · 200 · 120 ms",
    )

    await user.click(
      screen.getByRole("button", {
        name: "Open api.huniki.ai/translate",
      }),
    )

    await waitFor(() => {
      expect(screen.getByRole("textbox", { name: "Endpoint" })).toHaveValue(TRANSLATE_ENDPOINT)
    })
    expect(
      screen.getByRole("heading", {
        name: /Your endpoint requires a provider and an authentication token/,
      }),
    ).toBeInTheDocument()
  })

  it("hides and shows Recents from the section toggle", async () => {
    writeSavedTests([saved])
    const user = userEvent.setup()
    renderSidebar()

    expect(screen.getByRole("heading", { name: "Recents" })).not.toHaveClass("uppercase")
    expect(screen.getByRole("heading", { name: "Recents" })).toHaveClass("text-sm")
    expect(screen.getByRole("heading", { name: "Recents" })).not.toHaveClass("font-medium")
    expect(screen.getByRole("link", { name: "Settings" })).toHaveClass("text-sm")
    expect(screen.getByText("Translation succeeded")).toBeInTheDocument()

    await user.click(screen.getByRole("button", { name: "Hide recents" }))
    expect(
      screen.queryByRole("button", { name: "Open api.huniki.ai/translate" }),
    ).not.toBeInTheDocument()
    expect(window.localStorage.getItem("custom-check.recents-open")).toBe("false")

    await user.click(screen.getByRole("button", { name: "Show recents" }))
    expect(screen.getByRole("button", { name: "Open api.huniki.ai/translate" })).toBeInTheDocument()
    expect(window.localStorage.getItem("custom-check.recents-open")).toBe("true")
  })

  it("resizes the sidebar from the drag handle", async () => {
    const user = userEvent.setup()
    renderSidebar()

    const handle = screen.getByRole("slider", { name: "Resize sidebar" })
    expect(handle).toHaveAttribute("aria-valuenow", "256")
    expect(screen.getByRole("link", { name: "Home" })).toBeInTheDocument()

    handle.focus()
    await user.keyboard("{ArrowRight}")
    expect(screen.getByRole("link", { name: "Home" })).toBeInTheDocument()
    expect(handle).toHaveAttribute("aria-valuenow", "272")

    await user.keyboard("{End}")
    expect(handle).toHaveAttribute("aria-valuenow", "480")
    expect(window.localStorage.getItem("custom-check.sidebar-width")).toBe("480")

    await user.keyboard("{Home}")
    expect(screen.getByRole("button", { name: "Expand sidebar" })).toBeInTheDocument()
    expect(screen.queryByRole("link", { name: "Home" })).not.toBeInTheDocument()
    expect(handle).toHaveAttribute("aria-valuenow", "48")

    await user.click(screen.getByRole("button", { name: "Expand sidebar" }))
    expect(handle).toHaveAttribute("aria-valuenow", "480")
  })

  it("shows the theme meter when expanded and the current theme icon when collapsed", async () => {
    const user = userEvent.setup()
    renderSidebar()

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

  it("slides in from the left as a drawer on small screens", async () => {
    const previousMatchMedia = window.matchMedia
    window.matchMedia = ((query: string) => ({
      matches: query.includes("max-width: 767px"),
      media: query,
      onchange: null,
      addListener: () => {},
      removeListener: () => {},
      addEventListener: () => {},
      removeEventListener: () => {},
      dispatchEvent: () => false,
    })) as typeof window.matchMedia

    const user = userEvent.setup()
    renderSidebar()

    await waitFor(() => {
      expect(screen.getByRole("button", { name: "Expand sidebar" })).toBeInTheDocument()
    })
    expect(screen.queryByRole("dialog", { name: "Sidebar" })).not.toBeInTheDocument()
    expect(screen.queryByRole("link", { name: "Home" })).not.toBeInTheDocument()
    expect(screen.queryByRole("slider", { name: "Resize sidebar" })).not.toBeInTheDocument()

    await user.click(screen.getByRole("button", { name: "Expand sidebar" }))
    const drawer = await screen.findByRole("dialog", { name: "Sidebar" })
    expect(drawer).toHaveClass("translate-x-0", "w-full", "inset-0")
    expect(screen.getByRole("link", { name: "Home" })).toBeInTheDocument()
    expect(screen.getByRole("link", { name: "Settings" })).toBeInTheDocument()
    expect(screen.queryByRole("button", { name: "Close sidebar" })).not.toBeInTheDocument()

    await user.click(screen.getByRole("button", { name: "Collapse sidebar" }))
    expect(screen.queryByRole("dialog", { name: "Sidebar" })).not.toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Expand sidebar" })).toBeInTheDocument()
    window.matchMedia = previousMatchMedia
  })
})
