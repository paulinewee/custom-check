import { ImageResponse } from "next/og"

export const size = {
  width: 180,
  height: 180,
}

export const contentType = "image/png"

export default function AppleIcon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#111111",
        }}
      >
        <svg width="112" height="112" viewBox="0 0 20 20">
          <polygon points="10,4 16,11 4,11" fill="#f5f5f5" />
          <polygon points="10,8 16,15 4,15" fill="#f5f5f5" />
        </svg>
      </div>
    ),
    { ...size },
  )
}
