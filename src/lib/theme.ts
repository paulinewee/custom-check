import { APP_SLUG } from "@/lib/brand"

export const THEME_KEY = `${APP_SLUG}.theme`
export const THEMES = ["system", "light", "dark"] as const

export type Theme = (typeof THEMES)[number]

export function isTheme(value: unknown): value is Theme {
  return value === "system" || value === "light" || value === "dark"
}

export function prefersDark() {
  return window.matchMedia("(prefers-color-scheme: dark)").matches
}

export function isDarkTheme(theme: Theme) {
  return theme === "dark" || (theme === "system" && prefersDark())
}

export function applyTheme(theme: Theme) {
  const dark = isDarkTheme(theme)
  document.documentElement.classList.toggle("dark", dark)
  document.documentElement.style.colorScheme = dark ? "dark" : "light"
}

export function readStoredTheme(): Theme {
  if (typeof window === "undefined") return "dark"
  try {
    const stored = window.localStorage.getItem(THEME_KEY)
    return isTheme(stored) ? stored : "dark"
  } catch {
    return "dark"
  }
}

export function writeStoredTheme(theme: Theme) {
  window.localStorage.setItem(THEME_KEY, theme)
}

export const THEME_BOOTSTRAP = `(function(){try{var t=localStorage.getItem(${JSON.stringify(THEME_KEY)});if(t!=="light"&&t!=="dark"&&t!=="system")t="dark";var d=t==="dark"||(t==="system"&&matchMedia("(prefers-color-scheme: dark)").matches);document.documentElement.classList.toggle("dark",d);document.documentElement.style.colorScheme=d?"dark":"light"}catch(e){}})()`
