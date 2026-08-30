import type { Metadata } from "next"
import { Geist, Geist_Mono } from "next/font/google"

import { AppShell } from "@/components/app-shell"
import { APP_NAME } from "@/lib/brand"
import { THEME_BOOTSTRAP } from "@/lib/theme"

import "./globals.css"

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
})

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
})

export const metadata: Metadata = {
  title: APP_NAME,
  description: "Create custom requests to test an endpoint for your workflow.",
}

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <head>
        <script
          dangerouslySetInnerHTML={{ __html: THEME_BOOTSTRAP }}
        />
      </head>
      <body className="flex min-h-full flex-col bg-background text-foreground">
        <a
          href="#main"
          className="skip-link fixed top-3 left-3 z-50 rounded-md bg-foreground px-3 py-2 text-sm text-background focus-visible:ring-3 focus-visible:ring-ring/50"
        >
          Skip to main content
        </a>
        <AppShell>{children}</AppShell>
      </body>
    </html>
  )
}
