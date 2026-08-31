"use client"

import { Monitor, Moon, Sun } from "lucide-react"

import { useTheme } from "@/components/theme-provider"
import type { Theme } from "@/lib/theme"

const OPTIONS: { value: Theme; label: string; icon: typeof Sun }[] = [
  { value: "system", label: "System", icon: Monitor },
  { value: "light", label: "Light", icon: Sun },
  { value: "dark", label: "Dark", icon: Moon },
]

export function ThemeToggle({ variant = "meter" }: { variant?: "meter" | "icon" }) {
  const { theme, setTheme } = useTheme()
  const current = OPTIONS.find((option) => option.value === theme) ?? OPTIONS[2]

  if (variant === "icon") {
    const Icon = current.icon
    return (
      <button
        type="button"
        aria-label={current.label}
        title={current.label}
        onClick={() => {
          const index = OPTIONS.findIndex((option) => option.value === theme)
          setTheme(OPTIONS[(index + 1) % OPTIONS.length]!.value)
        }}
        className="inline-flex size-7 items-center justify-center rounded-full text-foreground outline-none transition-colors duration-[120ms] ease-out hover:bg-muted focus-visible:ring-3 focus-visible:ring-ring/50"
      >
        <Icon className="size-4" aria-hidden />
      </button>
    )
  }

  return (
    <div role="radiogroup" aria-label="Theme" className="inline-flex rounded-full border border-border p-0.5">
      {OPTIONS.map((option) => {
        const selected = theme === option.value
        const Icon = option.icon
        return (
          <button
            key={option.value}
            type="button"
            role="radio"
            aria-checked={selected}
            aria-label={option.label}
            onClick={() => setTheme(option.value)}
            className={
              selected
                ? "inline-flex size-7 items-center justify-center rounded-full bg-foreground text-background outline-none transition-colors duration-[120ms] ease-out focus-visible:ring-3 focus-visible:ring-ring/50"
                : "inline-flex size-7 items-center justify-center rounded-full text-muted-foreground outline-none transition-colors duration-[120ms] ease-out hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50"
            }
          >
            <Icon className="size-3.5" aria-hidden />
          </button>
        )
      })}
    </div>
  )
}
