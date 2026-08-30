"use client"

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react"

import {
  DEFAULT_SETTINGS,
  readSettings,
  writeSettings,
  type CheckSettings,
} from "@/lib/settings"

type SettingsContextValue = {
  settings: CheckSettings
  update: (next: CheckSettings) => void
  reset: () => void
}

const SettingsContext = createContext<SettingsContextValue | null>(null)

export function SettingsProvider({ children }: { children: React.ReactNode }) {
  const [settings, setSettings] = useState<CheckSettings>(DEFAULT_SETTINGS)

  useEffect(() => {
    setSettings(readSettings())
  }, [])

  const update = useCallback((next: CheckSettings) => {
    setSettings(writeSettings(next))
  }, [])

  const reset = useCallback(() => {
    setSettings(writeSettings(DEFAULT_SETTINGS))
  }, [])

  const value = useMemo(() => ({ settings, update, reset }), [reset, settings, update])

  return <SettingsContext.Provider value={value}>{children}</SettingsContext.Provider>
}

export function useCheckSettings() {
  const value = useContext(SettingsContext)
  if (!value) {
    return {
      settings: DEFAULT_SETTINGS,
      update: () => {},
      reset: () => {},
    } satisfies SettingsContextValue
  }
  return value
}
