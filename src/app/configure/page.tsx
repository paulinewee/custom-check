import type { Metadata } from "next"

import { ConfigurePractice } from "@/components/configure-practice"
import { APP_NAME } from "@/lib/brand"

export const metadata: Metadata = {
  title: `Configure Test Endpoint · ${APP_NAME}`,
  description: `Toggle a GhanaNLP-shaped practice API, then check it from ${APP_NAME}.`,
}

export default function ConfigurePage() {
  return (
    <main
      id="main"
      tabIndex={-1}
      className="mx-auto w-full max-w-2xl flex-1 px-4 py-10 outline-none sm:px-6 sm:py-14"
    >
      <ConfigurePractice />
    </main>
  )
}
