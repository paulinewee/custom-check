import type { Metadata } from "next"

import { SettingsForm } from "@/components/settings-form"
import { APP_NAME } from "@/lib/brand"

export const metadata: Metadata = {
  title: "Settings",
  description: `Configure the request shape and card fields ${APP_NAME} uses.`,
}

export default function SettingsPage() {
  return <SettingsForm />
}