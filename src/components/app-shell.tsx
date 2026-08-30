"use client"

import { AppSidebar } from "@/components/app-sidebar"
import { SavedTestsProvider } from "@/components/saved-tests-context"
import { ThemeProvider } from "@/components/theme-provider"

export function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <ThemeProvider>
      <SavedTestsProvider>
        <div className="flex min-h-svh flex-1">
          <AppSidebar />
          {children}
        </div>
      </SavedTestsProvider>
    </ThemeProvider>
  )
}
