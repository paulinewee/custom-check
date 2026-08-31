"use client"

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useLayoutEffect,
  useMemo,
  useState,
} from "react"

import {
  applyTheme,
  isTheme,
  readStoredTheme,
  writeStoredTheme,
  type Theme,
} from "@/lib/theme"

type ThemeContextValue = {
  theme: Theme
  setTheme: (theme: Theme) => void
}

const ThemeContext = createContext<ThemeContextValue | null>(null)

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setThemeState] = useState<Theme>("dark")

  useLayoutEffect(() => {
    const stored = readStoredTheme()
    setThemeState(stored)
    applyTheme(stored)
  }, [])

  useEffect(() => {
    if (theme !== "system") return
    const media = window.matchMedia("(prefers-color-scheme: dark)")
    function onChange() {
      applyTheme("system", { animate: true })
    }
    media.addEventListener("change", onChange)
    return () => media.removeEventListener("change", onChange)
  }, [theme])

  const setTheme = useCallback((next: Theme) => {
    if (!isTheme(next)) return
    writeStoredTheme(next)
    applyTheme(next, { animate: true })
    setThemeState(next)
  }, [])

  const value = useMemo(() => ({ theme, setTheme }), [setTheme, theme])

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
}

export function useTheme() {
  const value = useContext(ThemeContext)
  if (!value) {
    return {
      theme: "dark" as Theme,
      setTheme: () => {},
    }
  }
  return value
}
