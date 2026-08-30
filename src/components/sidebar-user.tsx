"use client"

import { ThemeToggle } from "@/components/theme-toggle"
import { cn } from "@/lib/utils"

export function SidebarUser({ collapsed }: { collapsed: boolean }) {
  return (
    <div
      className={cn(
        "flex h-8 items-center",
        collapsed ? "justify-center" : "gap-2 px-2.5",
      )}
    >
      {collapsed ? null : <span className="min-w-0 flex-1 truncate text-sm">Theme</span>}
      <ThemeToggle variant={collapsed ? "icon" : "meter"} />
    </div>
  )
}
