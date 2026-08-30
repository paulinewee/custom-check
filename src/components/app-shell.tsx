"use client"

import { AppSidebar } from "@/components/app-sidebar"
import { PageMain } from "@/components/page-main"
import { SavedTestsProvider } from "@/components/saved-tests-context"
import { SettingsProvider } from "@/components/settings-context"
import { ThemeProvider } from "@/components/theme-provider"

export function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <ThemeProvider>
      <SavedTestsProvider>
        <SettingsProvider>
          <div className="flex min-h-svh min-w-0 flex-1 flex-col overflow-x-clip md:flex-row">
            <AppSidebar />
            <div className="flex min-w-0 flex-1 flex-col">
              <PageMain>{children}</PageMain>
            </div>
          </div>
        </SettingsProvider>
      </SavedTestsProvider>
    </ThemeProvider>
  )
}
