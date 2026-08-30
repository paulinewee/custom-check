import { afterEach, describe, expect, it } from "vitest"

import { APP_DESCRIPTION, APP_NAME, siteUrl } from "@/lib/brand"

describe("siteUrl", () => {
  const originalSite = process.env.NEXT_PUBLIC_SITE_URL
  const originalVercel = process.env.VERCEL_PROJECT_PRODUCTION_URL

  afterEach(() => {
    process.env.NEXT_PUBLIC_SITE_URL = originalSite
    process.env.VERCEL_PROJECT_PRODUCTION_URL = originalVercel
  })

  it("uses the explicit site URL when set", () => {
    process.env.NEXT_PUBLIC_SITE_URL = "https://check.example"
    expect(siteUrl().href).toBe("https://check.example/")
  })

  it("falls back to localhost and keeps the product description", () => {
    delete process.env.NEXT_PUBLIC_SITE_URL
    delete process.env.VERCEL_PROJECT_PRODUCTION_URL
    expect(siteUrl().origin).toBe("http://localhost:3000")
    expect(APP_NAME).toBe("Custom Check")
    expect(APP_DESCRIPTION).toMatch(/capabilities, performance, and failures/)
  })
})