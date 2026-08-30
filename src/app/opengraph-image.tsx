import { ImageResponse } from "next/og"

import { APP_DESCRIPTION, APP_NAME } from "@/lib/brand"

export const alt = `${APP_NAME} — ${APP_DESCRIPTION}`
export const size = {
  width: 1200,
  height: 630,
}
export const contentType = "image/png"

export default function OpenGraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          padding: 80,
          background: "#111111",
          color: "#fafafa",
          fontFamily: "ui-sans-serif, system-ui, -apple-system, Segoe UI, sans-serif",
        }}
      >
        <svg width="72" height="72" viewBox="0 0 20 20">
          <polygon points="10,4 16,11 4,11" fill="#f5f5f5" />
          <polygon points="10,8 16,15 4,15" fill="#f5f5f5" />
        </svg>
        <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
          <div style={{ fontSize: 72, fontWeight: 600, letterSpacing: -1.5, lineHeight: 1.05 }}>
            {APP_NAME}
          </div>
          <div style={{ fontSize: 32, color: "#a3a3a3", lineHeight: 1.35, maxWidth: 860 }}>
            {APP_DESCRIPTION}
          </div>
        </div>
      </div>
    ),
    { ...size },
  )
}