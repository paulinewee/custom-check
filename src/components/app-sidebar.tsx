"use client"

import { useEffect, useRef, useState, type KeyboardEvent, type PointerEvent } from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { ChevronDown, PanelLeft } from "lucide-react"

import { CustomCheckMark } from "@/components/custom-check-mark"
import { APP_NAME, APP_SLUG } from "@/lib/brand"
import { SidebarUser } from "@/components/sidebar-user"
import { useSavedTests } from "@/components/saved-tests-context"
import { formatMs } from "@/lib/format"
import { formatSavedAt, testLabel } from "@/lib/saved-tests"
import { cn } from "@/lib/utils"

const SIDEBAR_WIDTH_KEY = `${APP_SLUG}.sidebar-width`
const RECENTS_OPEN_KEY = `${APP_SLUG}.recents-open`
const MOBILE_QUERY = "(max-width: 767px)"
const COLLAPSED_WIDTH = 48
const MIN_EXPANDED = 200
const MAX_WIDTH = 480
const DEFAULT_EXPANDED = 256
const SNAP_WIDTH = 148
const STEP = 16
const NAV_LINK =
  "block rounded-lg px-2.5 py-1.5 text-sm outline-none focus-visible:ring-3 focus-visible:ring-ring/50"

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

function readRecentsOpen() {
  try {
    const stored = window.localStorage.getItem(RECENTS_OPEN_KEY)
    if (stored === "false") return false
    if (stored === "true") return true
  } catch {
    /* ignore quota / private mode */
  }
  return true
}

function writeRecentsOpen(open: boolean) {
  try {
    window.localStorage.setItem(RECENTS_OPEN_KEY, String(open))
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
  { href: "/", label: "Home" },
  { href: "/configure", label: "Test Endpoint" },
  { href: "/settings", label: "Settings" },
] as const

function navItemCurrent(pathname: string, href: string) {
  if (href === "/") return pathname === "/"
  return pathname === href || pathname.startsWith(`${href}/`)
}

export function AppSidebar() {
  const pathname = usePathname()
  const { tests, openTest, selectedId, collapsed, setCollapsed } = useSavedTests()
  const lastExpandedRef = useRef(DEFAULT_EXPANDED)
  const [width, setWidth] = useState(DEFAULT_EXPANDED)
  const [dragging, setDragging] = useState(false)
  const [recentsOpen, setRecentsOpen] = useState(true)
  const [isMobile, setIsMobile] = useState(false)
  const drawerOpen = isMobile && !collapsed

  useEffect(() => {
    const stored = readExpandedWidth()
    lastExpandedRef.current = stored
    setRecentsOpen(readRecentsOpen())
    setWidth((current) => (current <= COLLAPSED_WIDTH ? current : stored))
  }, [])

  useEffect(() => {
    const media = window.matchMedia(MOBILE_QUERY)
    function sync() {
      setIsMobile(media.matches)
    }
    sync()
    media.addEventListener("change", sync)
    return () => media.removeEventListener("change", sync)
  }, [])

  useEffect(() => {
    if (!isMobile) return
    setCollapsed(true)
  }, [pathname, isMobile, setCollapsed])

  useEffect(() => {
    if (!drawerOpen) return
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = "hidden"
    function onKeyDown(event: globalThis.KeyboardEvent) {
      if (event.key === "Escape") setCollapsed(true)
    }
    window.addEventListener("keydown", onKeyDown)
    return () => {
      document.body.style.overflow = previousOverflow
      window.removeEventListener("keydown", onKeyDown)
    }
  }, [drawerOpen, setCollapsed])

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

  function closeIfMobile() {
    if (isMobile) setCollapsed(true)
  }

  function toggleButton(expanding: boolean) {
    return (
      <button
        type="button"
        aria-expanded={!collapsed}
        aria-controls="sidebar-nav"
        onClick={toggleCollapsed}
        className="relative inline-flex size-7 shrink-0 items-center justify-center rounded-md text-muted-foreground outline-none after:absolute after:-inset-2 hover:bg-muted hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50"
      >
        <PanelLeft className="size-4" aria-hidden />
        <span className="sr-only">{expanding ? "Expand sidebar" : "Collapse sidebar"}</span>
      </button>
    )
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
    <>
      {isMobile && collapsed ? (
        <div className="flex h-12 shrink-0 items-center px-3">
          {toggleButton(true)}
        </div>
      ) : null}
    <aside
      role={drawerOpen ? "dialog" : undefined}
      aria-modal={drawerOpen || undefined}
      aria-label="Sidebar"
      aria-hidden={isMobile && collapsed ? true : undefined}
      inert={isMobile && collapsed ? true : undefined}
      className={cn(
        "group/sidebar flex h-svh min-w-0 flex-col overflow-hidden border-r border-border bg-background",
        isMobile
          ? cn(
              "fixed inset-0 z-50 w-full border-r-0 transition-transform duration-200 ease-[var(--ease-drawer)] motion-reduce:transition-none",
              collapsed ? "-translate-x-full" : "translate-x-0",
            )
          : cn(
              "relative sticky top-0 shrink-0",
              collapsed ? "pl-px" : null,
              dragging ? null : "transition-[width] duration-200 ease-out",
            ),
      )}
      style={isMobile ? undefined : { width }}
    >
      <div
        className={cn(
          "flex h-12 shrink-0 items-center gap-1",
          collapsed && !isMobile ? "justify-center" : "px-2",
        )}
      >
        {collapsed && !isMobile ? null : (
          <Link
            href="/"
            onClick={closeIfMobile}
            className="flex min-w-0 flex-1 items-center gap-2 rounded-sm px-2.5 text-sm font-medium tracking-tight outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
          >
            <CustomCheckMark className="size-5 shrink-0 text-foreground" />
            <span className="min-w-0 truncate" translate="no">
              {APP_NAME}
            </span>
          </Link>
        )}
        {toggleButton(collapsed)}
      </div>

      <div
        id="sidebar-nav"
        aria-hidden={collapsed}
        inert={collapsed || undefined}
        className={cn(
          "flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden transition-opacity duration-200 ease-out",
          collapsed ? "pointer-events-none opacity-0" : "opacity-100",
        )}
      >
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
                            ? `${NAV_LINK} bg-muted text-foreground`
                            : `${NAV_LINK} text-muted-foreground hover:bg-muted/60 hover:text-foreground`
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
                className={cn(
                  "flex min-w-0 flex-col overflow-hidden border-t border-border px-2 py-3",
                  recentsOpen ? "min-h-0 flex-1" : "shrink-0",
                )}
                aria-labelledby="saved-checks-heading"
              >
                <div className="flex items-center justify-between gap-1">
                  <h2
                    id="saved-checks-heading"
                    className="px-2.5 text-sm text-muted-foreground"
                  >
                    Recents
                  </h2>
                  <button
                    type="button"
                    aria-expanded={recentsOpen}
                    aria-controls="saved-checks-list"
                    onClick={() => {
                      const next = !recentsOpen
                      setRecentsOpen(next)
                      writeRecentsOpen(next)
                    }}
                    className="relative inline-flex size-6 shrink-0 items-center justify-center rounded-md text-muted-foreground outline-none after:absolute after:-inset-2 hover:bg-muted hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50"
                  >
                    <ChevronDown
                      className={cn(
                        "size-3.5 transition-transform duration-[160ms] ease-out",
                        recentsOpen ? null : "-rotate-90",
                      )}
                      aria-hidden
                    />
                    <span className="sr-only">{recentsOpen ? "Hide recents" : "Show recents"}</span>
                  </button>
                </div>
                <ul
                  id="saved-checks-list"
                  hidden={!recentsOpen}
                  className="mt-2 flex min-h-0 min-w-0 flex-col gap-1 overflow-x-hidden overflow-y-auto overscroll-contain [content-visibility:auto]"
                >
                  {tests.map((test) => {
                    const selected = selectedId === test.id
                    return (
                      <li key={test.id} className="min-w-0">
                        <button
                          type="button"
                          aria-label={`Open ${testLabel(test.url)}`}
                          title={formatSavedAt(test.at)}
                          onClick={() => {
                            openTest(test)
                            closeIfMobile()
                          }}
                          className={
                            selected
                              ? "w-full min-w-0 overflow-hidden rounded-lg bg-muted px-2.5 py-1.5 text-left outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
                              : "w-full min-w-0 overflow-hidden rounded-lg px-2.5 py-1.5 text-left outline-none hover:bg-muted/60 focus-visible:ring-3 focus-visible:ring-ring/50"
                          }
                        >
                          <span className="block truncate text-sm font-medium">
                            {testLabel(test.url)}
                          </span>
                          <span className="mt-0.5 flex min-w-0 items-baseline gap-1.5 overflow-hidden text-xs text-muted-foreground">
                            <span className="min-w-0 truncate">{test.title}</span>
                            <span className="shrink-0 font-mono tabular-nums">
                              {" · "}
                              {test.status ?? "—"} · {formatMs(test.durationMs)}
                            </span>
                          </span>
                        </button>
                      </li>
                    )
                  })}
                </ul>
              </section>
            ) : null}
      </div>

      <div
        className={cn(
          "mt-auto shrink-0 border-t border-border bg-background py-3",
          collapsed ? "flex justify-center" : "px-2",
        )}
      >
        <SidebarUser collapsed={collapsed} />
      </div>

      {isMobile ? null : (
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
      )}
    </aside>
    </>
  )
}
