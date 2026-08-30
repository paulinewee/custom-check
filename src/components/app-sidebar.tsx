"use client"

import { useEffect, useRef, useState, type KeyboardEvent, type PointerEvent } from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { ChevronLeft, ChevronRight, X } from "lucide-react"

import { CustomCheckMark } from "@/components/custom-check-mark"
import { APP_NAME, APP_SLUG } from "@/lib/brand"
import { SidebarUser } from "@/components/sidebar-user"
import { useSavedTests } from "@/components/saved-tests-context"
import { formatMs } from "@/lib/format"
import { formatSavedAt, testLabel } from "@/lib/saved-tests"
import { cn } from "@/lib/utils"

const SIDEBAR_WIDTH_KEY = `${APP_SLUG}.sidebar-width`
const COLLAPSED_WIDTH = 56
const MIN_EXPANDED = 200
const MAX_WIDTH = 480
const DEFAULT_EXPANDED = 256
const SNAP_WIDTH = 148
const STEP = 16

function readExpandedWidth() {
  try {
    const stored = Number(window.localStorage.getItem(SIDEBAR_WIDTH_KEY))
    if (Number.isFinite(stored) && stored >= MIN_EXPANDED && stored <= MAX_WIDTH) {
      return Math.round(stored)
    }
  } catch {
    /* ignore quota / private mode */
  }
  return DEFAULT_EXPANDED
}

function writeExpandedWidth(width: number) {
  try {
    window.localStorage.setItem(SIDEBAR_WIDTH_KEY, String(width))
  } catch {
    /* ignore quota / private mode */
  }
}

function fitSidebarWidth(raw: number) {
  const clamped = Math.round(Math.min(MAX_WIDTH, Math.max(COLLAPSED_WIDTH, raw)))
  if (clamped < SNAP_WIDTH) return COLLAPSED_WIDTH
  return Math.max(MIN_EXPANDED, clamped)
}

const NAV_ITEMS = [
  { href: "/", label: "Overview" },
  { href: "/configure", label: "Configure Test Endpoint" },
  { href: "/docs", label: "Documentation" },
] as const

function navItemCurrent(pathname: string, href: string) {
  if (href === "/") return pathname === "/"
  return pathname === href || pathname.startsWith(`${href}/`)
}

export function AppSidebar() {
  const pathname = usePathname()
  const { tests, openTest, removeTest, selectedId, collapsed, setCollapsed } = useSavedTests()
  const lastExpandedRef = useRef(DEFAULT_EXPANDED)
  const [width, setWidth] = useState(COLLAPSED_WIDTH)
  const [dragging, setDragging] = useState(false)

  useEffect(() => {
    lastExpandedRef.current = readExpandedWidth()
  }, [])

  useEffect(() => {
    if (collapsed) {
      setWidth(COLLAPSED_WIDTH)
      return
    }
    setWidth((current) => (current > COLLAPSED_WIDTH ? current : lastExpandedRef.current))
  }, [collapsed])

  useEffect(() => {
    if (!dragging) return
    const previousCursor = document.body.style.cursor
    const previousSelect = document.body.style.userSelect
    document.body.style.cursor = "col-resize"
    document.body.style.userSelect = "none"
    return () => {
      document.body.style.cursor = previousCursor
      document.body.style.userSelect = previousSelect
    }
  }, [dragging])

  function applyWidth(raw: number) {
    const next = fitSidebarWidth(raw)
    setWidth(next)
    const nextCollapsed = next <= COLLAPSED_WIDTH
    setCollapsed(nextCollapsed)
    if (!nextCollapsed) {
      lastExpandedRef.current = next
      writeExpandedWidth(next)
    }
  }

  function toggleCollapsed() {
    if (collapsed) {
      setCollapsed(false)
      return
    }
    lastExpandedRef.current = width > COLLAPSED_WIDTH ? width : lastExpandedRef.current
    writeExpandedWidth(lastExpandedRef.current)
    setCollapsed(true)
  }

  function onResizePointerDown(event: PointerEvent<HTMLDivElement>) {
    if (event.button !== 0) return
    event.preventDefault()
    const startX = event.clientX
    const startWidth = width
    setDragging(true)

    function onMove(move: globalThis.PointerEvent) {
      applyWidth(startWidth + (move.clientX - startX))
    }
    function onUp() {
      setDragging(false)
      window.removeEventListener("pointermove", onMove)
      window.removeEventListener("pointerup", onUp)
      window.removeEventListener("pointercancel", onUp)
    }
    window.addEventListener("pointermove", onMove)
    window.addEventListener("pointerup", onUp)
    window.addEventListener("pointercancel", onUp)
  }

  function onResizeKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (event.key === "ArrowRight") {
      event.preventDefault()
      applyWidth(collapsed ? lastExpandedRef.current : width + STEP)
      return
    }
    if (event.key === "ArrowLeft") {
      event.preventDefault()
      applyWidth(width - STEP)
      return
    }
    if (event.key === "Home") {
      event.preventDefault()
      applyWidth(COLLAPSED_WIDTH)
      return
    }
    if (event.key === "End") {
      event.preventDefault()
      applyWidth(MAX_WIDTH)
    }
  }

  return (
    <aside
      className={cn(
        "group/sidebar relative sticky top-0 flex h-svh shrink-0 flex-col border-r border-border",
        dragging ? null : "transition-[width] duration-200 ease-out",
      )}
      style={{ width }}
    >
      <div
        className={
          collapsed
            ? "flex shrink-0 flex-col items-center gap-2 px-2 py-3"
            : "flex h-12 shrink-0 items-center justify-between gap-2 px-3"
        }
      >
        <Link
          href="/"
          className="flex items-center gap-2 rounded-sm text-sm font-medium tracking-tight outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
        >
          <CustomCheckMark className="size-5 shrink-0 text-foreground" />
          {collapsed ? <span className="sr-only">{APP_NAME}</span> : <span>{APP_NAME}</span>}
        </Link>
        <button
          type="button"
          aria-expanded={!collapsed}
          aria-controls="sidebar-nav"
          onClick={toggleCollapsed}
          className="inline-flex size-7 items-center justify-center rounded-md text-muted-foreground outline-none hover:bg-muted hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50"
        >
          {collapsed ? (
            <ChevronRight className="size-4" aria-hidden />
          ) : (
            <ChevronLeft className="size-4" aria-hidden />
          )}
          <span className="sr-only">{collapsed ? "Expand sidebar" : "Collapse sidebar"}</span>
        </button>
      </div>

      <div id="sidebar-nav" className="flex min-h-0 flex-1 flex-col overflow-hidden">
        {collapsed ? null : (
          <>
            <nav aria-label="Main" className="px-2 pb-3">
              <ul className="flex flex-col gap-1">
                {NAV_ITEMS.map((item) => {
                  const current = navItemCurrent(pathname, item.href)
                  return (
                    <li key={item.href}>
                      <Link
                        href={item.href}
                        aria-current={current ? "page" : undefined}
                        className={
                          current
                            ? "block rounded-lg px-2.5 py-1.5 text-sm text-foreground outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
                            : "block rounded-lg px-2.5 py-1.5 text-sm text-muted-foreground outline-none hover:text-foreground/80 focus-visible:ring-3 focus-visible:ring-ring/50"
                        }
                      >
                        {item.label}
                      </Link>
                    </li>
                  )
                })}
              </ul>
            </nav>

            {tests.length > 0 ? (
              <section
                className="flex min-h-0 flex-1 flex-col overflow-hidden border-t border-border px-2 py-3"
                aria-labelledby="saved-checks-heading"
              >
                <h2
                  id="saved-checks-heading"
                  className="px-2.5 text-xs font-medium tracking-wide text-muted-foreground uppercase"
                >
                  Checks
                </h2>
                <ul className="mt-2 flex min-h-0 flex-col gap-1 overflow-y-auto overscroll-contain">
                  {tests.map((test) => {
                    const selected = selectedId === test.id
                    return (
                      <li key={test.id}>
                        <div
                          className={
                            selected
                              ? "flex items-start gap-1 rounded-lg bg-muted"
                              : "flex items-start gap-1 rounded-lg hover:bg-muted/60"
                          }
                        >
                          <button
                            type="button"
                            aria-label={`Open ${testLabel(test.url)}`}
                            title={formatSavedAt(test.at)}
                            onClick={() => openTest(test)}
                            className="min-w-0 flex-1 rounded-lg px-2.5 py-1.5 text-left outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
                          >
                            <span className="block truncate text-sm font-medium">
                              {testLabel(test.url)}
                            </span>
                            <span className="mt-0.5 flex min-w-0 items-baseline gap-1.5 text-xs text-muted-foreground">
                              <span className="min-w-0 truncate">{test.title}</span>
                              <span className="shrink-0 font-mono tabular-nums">
                                {test.status ?? "—"} · {formatMs(test.durationMs)}
                              </span>
                            </span>
                          </button>
                          <button
                            type="button"
                            onClick={() => removeTest(test.id)}
                            className="mt-1 mr-1 inline-flex size-6 shrink-0 items-center justify-center rounded-md text-muted-foreground outline-none hover:bg-background hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50"
                          >
                            <X className="size-3.5" aria-hidden />
                            <span className="sr-only">Remove {testLabel(test.url)}</span>
                          </button>
                        </div>
                      </li>
                    )
                  })}
                </ul>
              </section>
            ) : null}
          </>
        )}
      </div>

      <div
        className={
          collapsed
            ? "mt-auto shrink-0 border-t border-border bg-background px-2 py-3"
            : "mt-auto shrink-0 border-t border-border bg-background px-3 py-3"
        }
      >
        <SidebarUser collapsed={collapsed} />
      </div>

      <div
        role="slider"
        aria-orientation="vertical"
        aria-label="Resize sidebar"
        aria-controls="sidebar-nav"
        aria-valuemin={COLLAPSED_WIDTH}
        aria-valuemax={MAX_WIDTH}
        aria-valuenow={width}
        aria-valuetext={`${width} pixels`}
        tabIndex={0}
        onPointerDown={onResizePointerDown}
        onDoubleClick={() => applyWidth(collapsed ? DEFAULT_EXPANDED : COLLAPSED_WIDTH)}
        onKeyDown={onResizeKeyDown}
        className="absolute inset-y-0 right-0 z-20 w-3 translate-x-1/2 cursor-col-resize touch-none outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
      >
        <span
          aria-hidden
          className={
            dragging
              ? "absolute inset-y-0 left-1/2 w-0.5 -translate-x-1/2 bg-foreground/50"
              : "absolute inset-y-0 left-1/2 w-px -translate-x-1/2 bg-transparent group-hover/sidebar:bg-border"
          }
        />
      </div>
    </aside>
  )
}
