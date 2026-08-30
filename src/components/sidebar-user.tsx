"use client"

import { ThemeToggle } from "@/components/theme-toggle"

export function SidebarUser({ collapsed }: { collapsed: boolean }) {
  if (collapsed) {
    return (
      <div className="flex justify-center">
        <ThemeToggle variant="icon" />
      </div>
    )
  }

  return (
    <div className="flex items-center justify-between gap-2">
      <span className="text-sm">Theme</span>
      <ThemeToggle />
    </div>
  )
}
