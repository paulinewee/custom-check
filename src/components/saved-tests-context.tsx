"use client"

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react"

import {
  readSavedTests,
  toSavedTest,
  writeSavedTests,
  type SavedTest,
  type SavedTestInput,
} from "@/lib/saved-tests"

type SavedTestsContextValue = {
  tests: SavedTest[]
  saveTest: (input: SavedTestInput) => void
  removeTest: (id: string) => void
  openTest: (test: SavedTest) => void
  pendingLoad: SavedTest | null
  consumePendingLoad: () => SavedTest | null
  selectedId: string | null
  collapsed: boolean
  setCollapsed: (collapsed: boolean) => void
}

const SavedTestsContext = createContext<SavedTestsContextValue | null>(null)

export function SavedTestsProvider({ children }: { children: React.ReactNode }) {
  const [tests, setTests] = useState<SavedTest[]>([])
  const [pendingLoad, setPendingLoad] = useState<SavedTest | null>(null)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [collapsed, setCollapsed] = useState(true)

  useEffect(() => {
    setTests(readSavedTests())
  }, [])

  const saveTest = useCallback((input: SavedTestInput) => {
    const entry = toSavedTest(input)
    setTests((current) => writeSavedTests([entry, ...current.filter((item) => item.id !== entry.id)]))
  }, [])

  const removeTest = useCallback((id: string) => {
    setTests((current) => writeSavedTests(current.filter((item) => item.id !== id)))
    setSelectedId((current) => (current === id ? null : current))
  }, [])

  const openTest = useCallback((test: SavedTest) => {
    setSelectedId(test.id)
    setPendingLoad(test)
    setCollapsed(false)
  }, [])

  const consumePendingLoad = useCallback(() => {
    const loaded = pendingLoad
    if (loaded) setPendingLoad(null)
    return loaded
  }, [pendingLoad])

  const value = useMemo(
    () => ({
      tests,
      saveTest,
      removeTest,
      openTest,
      pendingLoad,
      consumePendingLoad,
      selectedId,
      collapsed,
      setCollapsed,
    }),
    [
      collapsed,
      consumePendingLoad,
      openTest,
      pendingLoad,
      removeTest,
      saveTest,
      selectedId,
      tests,
    ],
  )

  return <SavedTestsContext.Provider value={value}>{children}</SavedTestsContext.Provider>
}

export function useSavedTests() {
  const value = useContext(SavedTestsContext)
  if (!value) {
    return {
      tests: [],
      saveTest: () => {},
      removeTest: () => {},
      openTest: () => {},
      pendingLoad: null,
      consumePendingLoad: () => null,
      selectedId: null,
      collapsed: true,
      setCollapsed: () => {},
    } satisfies SavedTestsContextValue
  }
  return value
}
