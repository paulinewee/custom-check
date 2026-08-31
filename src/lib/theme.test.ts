import { afterEach, describe, expect, it, vi } from "vitest"

import { THEME_KEY, applyTheme, isTheme, readStoredTheme, writeStoredTheme } from "./theme"

describe("theme", () => {
  afterEach(() => {
    window.localStorage.clear()
    document.documentElement.classList.remove("dark")
    document.documentElement.style.colorScheme = ""
  })

  it("accepts only known themes", () => {
    expect(isTheme("dark")).toBe(true)
    expect(isTheme("midnight")).toBe(false)
  })

  it("applies the dark class and color-scheme", () => {
    applyTheme("light")
    expect(document.documentElement).not.toHaveClass("dark")
    expect(document.documentElement.style.colorScheme).toBe("light")

    applyTheme("dark")
    expect(document.documentElement).toHaveClass("dark")
    expect(document.documentElement.style.colorScheme).toBe("dark")

    applyTheme("light", { animate: true })
    expect(document.documentElement).not.toHaveClass("dark")
    expect(document.documentElement.style.colorScheme).toBe("light")
  })

  it("crossfades with a view transition when asked to animate", () => {
    const start = vi.fn((update: () => void) => {
      update()
      return { finished: Promise.resolve() }
    })
    Object.defineProperty(document, "startViewTransition", {
      configurable: true,
      value: start,
    })

    applyTheme("dark", { animate: true })
    expect(start).toHaveBeenCalledTimes(1)
    expect(document.documentElement).toHaveClass("dark")

    Reflect.deleteProperty(document, "startViewTransition")
  })

  it("round-trips the stored preference", () => {
    writeStoredTheme("system")
    expect(window.localStorage.getItem(THEME_KEY)).toBe("system")
    expect(readStoredTheme()).toBe("system")
  })
})
