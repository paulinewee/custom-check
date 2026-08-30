import type { MetadataRoute } from "next"

import { siteUrl } from "@/lib/brand"

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
    },
    host: siteUrl().origin,
  }
}