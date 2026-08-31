import type { Metadata } from "next"

import { ConfigurePractice } from "@/components/configure-practice"

export const metadata: Metadata = {
  title: "Test Endpoint",
  description: "Use this endpoint for testing in lieu of a live API service.",
}

export default function ConfigurePage() {
  return <ConfigurePractice />
}