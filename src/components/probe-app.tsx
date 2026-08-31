"use client"

import { useEffect, useId, useLayoutEffect, useMemo, useRef, useState } from "react"
import { Check, ChevronDown, CircleHelp, LoaderCircle, TriangleAlert, X } from "lucide-react"

import { CodeBlock, highlightCurl } from "@/components/code-block"
import { useSavedTests } from "@/components/saved-tests-context"
import { useCheckSettings } from "@/components/settings-context"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Field, FieldError, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Separator } from "@/components/ui/separator"
import { Textarea } from "@/components/ui/textarea"
import { collectShape, parseJson } from "@/lib/probe/assert"
import {
  DEFAULT_LATENCY_MS,
  DEFAULT_REQUEST_COUNT,
  MAX_REQUESTS,
} from "@/lib/probe/constants"
import {
  compileTranslateBody,
  HUNIKI_LANGUAGES,
  HUNIKI_PROVIDERS,
  HUNIKI_LANGUAGE_PAIRS,
  inferDefaults,
  valuesForLanguagePair,
  valuesFromShape,
  type BodyField,
  type BodyFieldRole,
  type FieldValues,
} from "@/lib/probe/defaults"
import { APP_DESCRIPTION, APP_HEADLINE } from "@/lib/brand"
import { formatMs, formatTextStats } from "@/lib/format"
import { cn } from "@/lib/utils"
import { buildCurl } from "@/lib/probe/preview"
import { normalizeEndpointUrl, validateEndpointUrl } from "@/lib/probe/url-client"
import {
  firstCustomizeError,
  validateRequestForm,
  validateSecret,
  type RequestFieldId,
} from "@/lib/probe/validate-form"
import type {
  Assertion,
  Dimension,
  SendMode,
  TestRequest,
  TestResult,
} from "@/lib/probe/types"

type AuthPhase = "idle" | "checking" | "valid" | "invalid"

const CHOICE_CHIP =
  "inline-flex h-8 cursor-pointer items-center gap-1.5 rounded-lg border border-border px-2.5 text-sm transition-transform duration-[160ms] ease-out active:scale-[0.97] has-[:focus-visible]:border-ring has-[:focus-visible]:ring-3 has-[:focus-visible]:ring-ring/50"

const CHOICE_RADIO =
  "size-3.5 appearance-none rounded-full border border-zinc-300 bg-transparent dark:border-zinc-600 checked:border-zinc-400 checked:bg-[radial-gradient(circle,theme(colors.zinc.400)_38%,transparent_42%)] dark:checked:border-zinc-500 dark:checked:bg-[radial-gradient(circle,theme(colors.zinc.400)_38%,transparent_42%)]"

function emptyAssertion(path: string): Assertion {
  return { path, kind: "nonempty" }
}

function optionsForField(role: BodyFieldRole) {
  if (role === "provider") {
    return HUNIKI_PROVIDERS.map((item) => ({ value: item.value, label: item.label }))
  }
  if (role === "source" || role === "target") {
    return HUNIKI_LANGUAGES.map((item) => ({ value: item.code, label: item.name }))
  }
  return []
}

function previewRequestCount(value: string) {
  const count = Number(value)
  if (!Number.isFinite(count) || count < 1) return 1
  return Math.min(MAX_REQUESTS, Math.floor(count))
}

function isMultipleRequests(value: string) {
  const count = Number(value)
  return Number.isFinite(count) && count > 1
}

function curlFirstLine(curl: string) {
  return (curl.split("\n")[0] ?? curl).replace(/\s*\\$/, "").trimEnd()
}

function curlRest(curl: string) {
  const index = curl.indexOf("\n")
  return index === -1 ? "" : curl.slice(index + 1)
}

function HighlightedCurl({ code }: { code: string }) {
  return highlightCurl(code).map((part, index) => (
    <span key={index} className={part.className}>
      {part.text}
    </span>
  ))
}

function RequestPreviewList({ curls }: { curls: string[] }) {
  return (
    <div className="max-h-[28rem] overflow-auto overscroll-contain">
      {curls.map((curl, index) => {
        const firstLine = curlFirstLine(curl)
        const rest = curlRest(curl)
        return (
          <details
            key={index}
            className="group border-b border-border last:border-b-0"
          >
            <summary className="flex cursor-pointer list-none items-center gap-2 px-4 py-2.5 text-xs focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none [&::-webkit-details-marker]:hidden">
              <span className="min-w-0 flex-1 truncate font-mono">
                <HighlightedCurl code={firstLine} />
              </span>
              <ChevronDown className="size-3.5 shrink-0 text-muted-foreground transition-transform duration-[160ms] ease-out -rotate-90 group-open:rotate-0" />
            </summary>
            {rest ? (
              <pre
                translate="no"
                className="max-h-56 overflow-auto overscroll-contain px-4 pb-3 font-mono text-xs break-words whitespace-pre-wrap text-foreground"
              >
                <code>
                  <HighlightedCurl code={rest} />
                </code>
              </pre>
            ) : null}
          </details>
        )
      })}
    </div>
  )
}

const DIMENSION_LABEL: Record<Dimension, string> = {
  pass: "Passed",
  warn: "Slow",
  fail: "Failed",
  unknown: "Not checked",
}

const HEALTH_CHECKS = [
  {
    key: "reachable",
    title: "Reached the host",
    tipLabel: "About reaching the host",
    tip: "Whether the host answered at all. Failure usually means DNS, a blocked network, or a timeout.",
  },
  {
    key: "authenticated",
    title: "Authentication",
    tipLabel: "About authentication",
    tip: "Whether the service accepted your credentials. 401 or 403 means the token is missing, wrong, or not entitled.",
  },
  {
    key: "requestValid",
    title: "Request shape",
    tipLabel: "About the request shape",
    tip: "Whether the method, headers, and body were accepted. 400 or 422 means the request shape is wrong.",
  },
  {
    key: "expectedOutput",
    title: "Expected output",
    tipLabel: "About expected output",
    tip: "Whether the response contained the fields a working call should return.",
  },
  {
    key: "latency",
    title: "Response time",
    tipLabel: "About response time",
    tip: "How long the provider took to return a response.",
  },
] as const satisfies ReadonlyArray<{
  key: keyof TestResult["health"]
  title: string
  tipLabel: string
  tip: string
}>

function syncAddressBar(url: string) {
  const next = url.trim() ? `/?url=${encodeURIComponent(url.trim())}` : "/"
  if (`${window.location.pathname}${window.location.search}` !== next) {
    window.history.replaceState(null, "", next)
  }
}

function pretty(body: string) {
  const json = parseJson(body)
  return json === undefined ? body : JSON.stringify(json, null, 2)
}

function tokenAccepted(result: TestResult) {
  return result.health.authenticated === "pass"
}

function averageDurationMs(runs: TestResult[]) {
  const durations = runs
    .map((item) => item.response?.durationMs)
    .filter((value): value is number => typeof value === "number")
  if (durations.length === 0) return null
  return Math.round(durations.reduce((sum, value) => sum + value, 0) / durations.length)
}

function resultCardTitle(result: TestResult, durationMs?: number | null) {
  const duration =
    durationMs != null
      ? formatMs(durationMs)
      : result.response
        ? formatMs(result.response.durationMs)
        : null
  if (result.overall === "healthy" || result.overall === "degraded") {
    return duration ? `Your request succeeded in ${duration}` : "Your request succeeded"
  }
  return result.diagnosis.title
}

function RunResultsTable({
  runs,
  selectedIndex,
  onSelect,
}: {
  runs: TestResult[]
  selectedIndex: number
  onSelect: (index: number) => void
}) {
  const rowRefs = useRef<(HTMLTableRowElement | null)[]>([])

  function moveTo(index: number) {
    const next = Math.min(runs.length - 1, Math.max(0, index))
    onSelect(next)
    rowRefs.current[next]?.focus()
  }

  return (
    <div className="overflow-hidden rounded-lg border border-border bg-muted/40">
      <table aria-label="Request results" className="w-full text-xs">
        <caption className="sr-only">
          Select a row to inspect that response.
        </caption>
        <thead>
          <tr className="border-b border-border text-left text-muted-foreground">
            <th scope="col" className="w-10 px-3 py-2 font-medium">
              #
            </th>
            <th scope="col" className="px-3 py-2 font-medium">
              Status
            </th>
            <th scope="col" className="px-3 py-2 font-medium">
              Time
            </th>
            <th scope="col" className="px-3 py-2 font-medium">
              Result
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border/70 font-mono tabular-nums">
          {runs.map((item, index) => (
            <tr
              key={`${item.response?.durationMs ?? 0}-${index}`}
              ref={(node) => {
                rowRefs.current[index] = node
              }}
              tabIndex={0}
              aria-selected={index === selectedIndex}
              aria-label={`Request ${index + 1}, ${item.response?.status ?? "no status"}, ${
                item.response ? formatMs(item.response.durationMs) : "no time"
              }, ${item.overall}`}
              className={cn(
                "cursor-pointer outline-none focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:ring-inset",
                index === selectedIndex ? "bg-background" : "hover:bg-background/70",
              )}
              onClick={() => onSelect(index)}
              onKeyDown={(event) => {
                if (event.key === "Enter" || event.key === " ") {
                  event.preventDefault()
                  onSelect(index)
                  return
                }
                if (event.key === "ArrowDown") {
                  event.preventDefault()
                  moveTo(index + 1)
                  return
                }
                if (event.key === "ArrowUp") {
                  event.preventDefault()
                  moveTo(index - 1)
                  return
                }
                if (event.key === "Home") {
                  event.preventDefault()
                  moveTo(0)
                  return
                }
                if (event.key === "End") {
                  event.preventDefault()
                  moveTo(runs.length - 1)
                }
              }}
            >
              <td className="px-3 py-1.5 text-muted-foreground">{index + 1}</td>
              <td className="px-3 py-1.5">{item.response?.status ?? "—"}</td>
              <td className="px-3 py-1.5">{item.response ? formatMs(item.response.durationMs) : "—"}</td>
              <td className="px-3 py-1.5">{item.overall}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function explainHealth(
  key: (typeof HEALTH_CHECKS)[number]["key"],
  result: TestResult,
  durationMs?: number | null,
): string {
  const status = result.response?.status
  const duration = durationMs ?? result.response?.durationMs
  const value = result.health[key]

  if (key === "reachable") {
    if (value === "pass") {
      return status ? `The host was reached with HTTP ${status}` : "The host was reached"
    }
    if (value === "fail") {
      if (result.classification === "dns") return "The hostname could not be resolved"
      if (result.classification === "timeout") return "The host did not finish in time"
      if (result.classification === "network") return "The connection failed before a response arrived"
      return "The host could not be reached"
    }
    return "We could not tell if the host was reached"
  }

  if (key === "authenticated") {
    if (value === "pass") return "The authentication token was accepted"
    if (value === "fail") {
      return status
        ? `The authentication token was rejected with HTTP ${status}`
        : "The authentication token was rejected"
    }
    return "We could not tell if the authentication token was accepted"
  }

  if (key === "requestValid") {
    if (value === "pass") return "The request method, headers, and body were accepted"
    if (value === "fail") {
      return status
        ? `The request shape was rejected with HTTP ${status}`
        : "The request shape was rejected"
    }
    return "We could not tell if the request shape was accepted"
  }

  if (key === "expectedOutput") {
    if (value === "pass") {
      const field = result.suggestedAssertions[0]?.path
      return field
        ? `The response included usable output, including ${field}`
        : "The response included a usable body"
    }
    if (value === "fail") return "The response was missing a field we required"
    return "We could not check the output"
  }

  if (value === "pass" && duration != null) {
    return `The response arrived in ${formatMs(duration)}`
  }
  if (value === "warn" && duration != null) {
    return `The response took ${formatMs(duration)}`
  }
  if (value === "fail") {
    return "We did not get a timed response"
  }
  return "We could not measure how long the response took"
}

function HealthStatus({ value }: { value: Dimension }) {
  const label = DIMENSION_LABEL[value]
  if (value === "pass") {
    return (
      <span className="mt-0.5 text-emerald-600 dark:text-emerald-400">
        <Check className="size-3.5" aria-hidden />
        <span className="sr-only">{label}</span>
      </span>
    )
  }
  if (value === "warn") {
    return (
      <span className="mt-0.5 text-amber-600 dark:text-amber-400">
        <TriangleAlert className="size-3.5" aria-hidden />
        <span className="sr-only">{label}</span>
      </span>
    )
  }
  if (value === "fail") {
    return (
      <span className="mt-0.5 text-red-600 dark:text-red-400">
        <X className="size-3.5" aria-hidden />
        <span className="sr-only">{label}</span>
      </span>
    )
  }
  return <span className="sr-only">{label}</span>
}

function InfoTip({
  label,
  children,
  align = "start",
}: {
  label: string
  children: string
  align?: "start" | "end"
}) {
  const id = useId()
  const rootRef = useRef<HTMLSpanElement>(null)
  const [open, setOpen] = useState(false)

  useEffect(() => {
    if (!open) return
    function onPointerDown(event: PointerEvent) {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false)
    }
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false)
    }
    document.addEventListener("pointerdown", onPointerDown)
    document.addEventListener("keydown", onKeyDown)
    return () => {
      document.removeEventListener("pointerdown", onPointerDown)
      document.removeEventListener("keydown", onKeyDown)
    }
  }, [open])

  return (
    <span ref={rootRef} className="relative inline-flex">
      <button
        type="button"
        aria-label={label}
        aria-expanded={open}
        aria-controls={id}
        onClick={(event) => {
          event.preventDefault()
          event.stopPropagation()
          setOpen((on) => !on)
        }}
        className="inline-flex size-5 shrink-0 items-center justify-center rounded-full text-muted-foreground hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50 outline-none"
      >
        <CircleHelp className="size-3.5" aria-hidden />
      </button>
      {open ? (
        <span
          id={id}
          role="note"
          className={cn(
            "absolute top-[calc(100%+6px)] z-50 w-64 rounded-md border border-border bg-popover px-2 py-1.5 text-xs leading-snug text-pretty text-popover-foreground shadow-md transition-[opacity,transform] duration-[160ms] ease-out starting:scale-[0.97] starting:opacity-0",
            align === "end" ? "right-0 origin-top-right" : "left-0 origin-top-left",
          )}
        >
          {children}
        </span>
      ) : null}
    </span>
  )
}

export function ProbeApp({ initialUrl }: { initialUrl: string }) {
  const abortRef = useRef<AbortController | null>(null)
  const pendingFocusRef = useRef<string | null>(null)
  const checkTimerRef = useRef<number>(0)
  const lastCheckedSecret = useRef("")
  const { saveTest, pendingLoad, consumePendingLoad } = useSavedTests()
  const { settings } = useCheckSettings()
  const inferredShape = settings.shape

  const [url, setUrl] = useState(initialUrl)
  const method = "POST" as const
  const [urlError, setUrlError] = useState<string | null>(
    initialUrl ? validateEndpointUrl(initialUrl) : null,
  )
  const [secret, setSecret] = useState("")
  const [authPhase, setAuthPhase] = useState<AuthPhase>("idle")
  const [authOpen, setAuthOpen] = useState(true)
  const [authError, setAuthError] = useState<string | null>(null)
  const contentType = "application/json"
  const [values, setValues] = useState<FieldValues>(() => valuesFromShape(inferredShape))
  const [requestTab, setRequestTab] = useState<"fields" | "preview">("fields")
  const latencyMs = String(settings.latencyMs || DEFAULT_LATENCY_MS)
  const [requestCount, setRequestCount] = useState(String(DEFAULT_REQUEST_COUNT))
  const [allLanguagePairs, setAllLanguagePairs] = useState(false)
  const savedRequestCountRef = useRef(String(DEFAULT_REQUEST_COUNT))
  const [sendMode, setSendMode] = useState<SendMode>("sequential")
  const [assertions, setAssertions] = useState<Assertion[]>(() =>
    settings.flagEmpty ? [emptyAssertion(settings.emptyPath)] : [],
  )
  const [result, setResult] = useState<TestResult | null>(null)
  const [runs, setRuns] = useState<TestResult[]>([])
  const [selectedRunIndex, setSelectedRunIndex] = useState(0)
  const [previousShape, setPreviousShape] = useState<string[]>([])
  const [testing, setTesting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [secretTouched, setSecretTouched] = useState(false)
  const [requestTouched, setRequestTouched] = useState<Partial<Record<RequestFieldId, boolean>>>({})
  const [requestErrorsVisible, setRequestErrorsVisible] = useState(false)

  const defaults = useMemo(
    () => ({
      ...inferDefaults(),
      shape: settings.shape,
      authKind: settings.authKind,
      headerName: settings.authKey,
    }),
    [settings.authKey, settings.authKind, settings.shape],
  )
  const providerField = defaults.shape.fields.find((field) => field.role === "provider")
  const customizeFields = defaults.shape.fields.filter((field) => field.role !== "provider")
  const languageFields = customizeFields.filter((field) => field.role === "source" || field.role === "target")
  const otherCustomizeFields = customizeFields.filter(
    (field) => field.role !== "source" && field.role !== "target",
  )
  const canTestAllPairs =
    languageFields.some((field) => field.role === "source") &&
    languageFields.some((field) => field.role === "target")
  const allPairsActive = allLanguagePairs && canTestAllPairs
  const defaultBody = compileTranslateBody(defaults.shape, values, secret, settings.authKey)
  const settingsFingerprint = JSON.stringify({
    shape: settings.shape,
    emptyPath: settings.emptyPath,
    flagEmpty: settings.flagEmpty,
  })

  useEffect(() => {
    setValues(valuesFromShape(settings.shape))
    setAssertions(settings.flagEmpty ? [emptyAssertion(settings.emptyPath)] : [])
  }, [settingsFingerprint])
  const hasEndpoint = url.trim().length > 0 && !urlError
  const authOk = authPhase === "valid"
  const requestValidation = useMemo(
    () =>
      validateRequestForm({
        method,
        bodyKind: defaults.bodyKind,
        fields: defaults.shape.fields,
        values,
        contentType,
        latencyMs,
        requestCount,
        allLanguagePairs: allLanguagePairs && canTestAllPairs,
      }),
    [
      allLanguagePairs,
      canTestAllPairs,
      contentType,
      defaults.bodyKind,
      defaults.shape.fields,
      latencyMs,
      method,
      requestCount,
      values,
    ],
  )

  const request: TestRequest = useMemo(
    () => ({
      url: normalizeEndpointUrl(url),
      method,
      auth: secret
        ? {
            kind: defaults.authKind,
            headerName: defaults.headerName,
            queryName: settings.authKey,
            secret,
          }
        : undefined,
      headers: { "Content-Type": contentType },
      body: defaults.bodyKind !== "none" ? defaultBody : undefined,
      assertions,
      latencyMs: Number(latencyMs) || DEFAULT_LATENCY_MS,
    }),
    [
      assertions,
      contentType,
      defaultBody,
      defaults.authKind,
      defaults.bodyKind,
      defaults.headerName,
      latencyMs,
      method,
      secret,
      settings.authKey,
      url,
    ],
  )

  const curl = useMemo(() => buildCurl(request, true), [request])
  const previewCurls = useMemo(() => {
    if (!(allLanguagePairs && canTestAllPairs)) {
      return Array.from({ length: previewRequestCount(requestCount) }, () => curl)
    }
    return HUNIKI_LANGUAGE_PAIRS.map((pair) =>
      buildCurl(
        {
          ...request,
          body: compileTranslateBody(
            defaults.shape,
            valuesForLanguagePair(values, defaults.shape.fields, pair),
            secret,
            settings.authKey,
          ),
        },
        true,
      ),
    )
  }, [
    allLanguagePairs,
    canTestAllPairs,
    curl,
    defaults.shape,
    request,
    requestCount,
    secret,
    settings.authKey,
    values,
  ])
  const selectedResult = runs[selectedRunIndex] ?? result
  const averageMs = averageDurationMs(runs.length > 0 ? runs : result ? [result] : [])
  const prettyBody = useMemo(
    () => (selectedResult?.response ? pretty(selectedResult.response.body) : ""),
    [selectedResult],
  )

  useEffect(() => {
    const skip = document.querySelector<HTMLAnchorElement>('a[href="#main"]')
    function onSkip() {
      document.getElementById("main")?.focus()
    }
    skip?.addEventListener("click", onSkip)
    return () => {
      skip?.removeEventListener("click", onSkip)
      abortRef.current?.abort()
      window.clearTimeout(checkTimerRef.current)
    }
  }, [])

  useEffect(() => {
    if (initialUrl) return
    if (!window.matchMedia("(hover: hover) and (pointer: fine)").matches) return
    document.getElementById("endpoint-url")?.focus()
  }, [initialUrl])

  useLayoutEffect(() => {
    if (!initialUrl) document.getElementById("endpoint-url")?.focus()
  }, [initialUrl])

  useLayoutEffect(() => {
    const id = pendingFocusRef.current
    if (!id) return
    pendingFocusRef.current = null
    document.getElementById(id)?.focus()
  })

  function focusAfterPaint(id: string) {
    pendingFocusRef.current = id
    queueMicrotask(() => {
      if (pendingFocusRef.current !== id) return
      const node = document.getElementById(id)
      if (!node) return
      pendingFocusRef.current = null
      node.focus()
    })
  }

  function resetAuth() {
    lastCheckedSecret.current = ""
    setAuthPhase("idle")
    setAuthOpen(true)
    setAuthError(null)
    setSecretTouched(false)
  }

  function resetRequestErrors() {
    setRequestTouched({})
    setRequestErrorsVisible(false)
  }

  function shownRequestError(id: RequestFieldId) {
    return requestErrorsVisible || requestTouched[id]
      ? (requestValidation.errors[id] ?? null)
      : null
  }

  function touchRequest(id: RequestFieldId) {
    setRequestTouched((current) => ({ ...current, [id]: true }))
  }

  function onUrlChange(value: string) {
    abortRef.current?.abort()
    window.clearTimeout(checkTimerRef.current)
    setTesting(false)
    setUrl(value)
    const invalid = value.trim() ? validateEndpointUrl(value) : null
    setUrlError(invalid)
    resetAuth()
    resetRequestErrors()
    setAssertions(settings.flagEmpty ? [emptyAssertion(settings.emptyPath)] : [])
    setResult(null)
    setRuns([])
    setSelectedRunIndex(0)
    if (value.trim()) {
      setValues(valuesFromShape(settings.shape))
      setRequestTab("fields")
    }
  }

  useEffect(() => {
    if (!pendingLoad) return
    const loaded = consumePendingLoad()
    if (!loaded) return
    onUrlChange(loaded.url)
    syncAddressBar(loaded.url)
    focusAfterPaint("endpoint-url")
  }, [consumePendingLoad, pendingLoad])

  function showRequestError(firstId: RequestFieldId) {
    setRequestErrorsVisible(true)
    setRequestTab("fields")
    if (firstId === "provider") {
      setAuthOpen(true)
      focusAfterPaint(providerField?.key ?? firstId)
      return
    }
    if (firstId === "text" || firstId === "source" || firstId === "target") {
      const field = customizeFields.find((item) => item.role === firstId)
      focusAfterPaint(field?.key ?? firstId)
      return
    }
    focusAfterPaint(firstId)
  }

  function submitRequest() {
    const invalidUrl = validateEndpointUrl(url)
    setUrlError(invalidUrl)
    if (invalidUrl) {
      focusAfterPaint("endpoint-url")
      return
    }

    if (!authOk) {
      const invalidSecret = validateSecret(secret)
      setSecretTouched(true)
      setAuthOpen(true)
      setAuthError(invalidSecret)
      setAuthPhase(invalidSecret ? "invalid" : authPhase)
      focusAfterPaint("secret")
      return
    }

    if (testing) return

    const customizeId = firstCustomizeError(requestValidation.errors)
    if (customizeId) {
      showRequestError(customizeId)
      return
    }

    void run(request, "request")
  }

  async function postTest(payload: TestRequest, signal: AbortSignal): Promise<TestResult> {
    const response = await fetch("/api/test", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ ...payload, previousShape }),
      signal,
    })
    if (!response.ok) {
      const body = (await response.json()) as { error?: string }
      throw new Error(body.error ?? "Check failed")
    }
    return (await response.json()) as TestResult
  }

  function finishRequestResults(payload: TestRequest, nextResults: TestResult[]) {
    const next = nextResults.at(-1)
    if (!next) return
    setRuns(nextResults)
    setResult(next)
    setSelectedRunIndex(0)
    if (next.response) {
      setPreviousShape(collectShape(next.response.body))
    }
    saveTest({
      url: payload.url,
      method: payload.method,
      overall: next.overall,
      title: next.diagnosis.title,
      explanation: next.diagnosis.explanation,
      status: next.response?.status,
      durationMs: averageDurationMs(nextResults) ?? next.response?.durationMs ?? 0,
    })
    focusAfterPaint("result-heading")
  }

  async function run(payload: TestRequest, kind: "auth" | "request") {
    const invalid = validateEndpointUrl(payload.url)
    setUrlError(invalid)
    if (invalid) {
      focusAfterPaint("endpoint-url")
      return
    }
    if (kind === "auth" && validateSecret(payload.auth?.secret ?? "")) {
      return
    }
    if (kind === "request" && requestValidation.firstId) {
      submitRequest()
      return
    }

    abortRef.current?.abort()
    const controller = new AbortController()
    abortRef.current = controller
    setError(null)
    if (kind === "auth") {
      setAuthPhase("checking")
      setAuthError(null)
    } else {
      setTesting(true)
    }
    syncAddressBar(payload.url)

    try {
      if (kind === "auth") {
        const next = await postTest(payload, controller.signal)
        if (controller.signal.aborted) return
        lastCheckedSecret.current = payload.auth?.secret ?? ""
        if (tokenAccepted(next)) {
          setAuthPhase("valid")
          setAuthError(null)
          setAuthOpen(false)
          focusAfterPaint("request-heading")
        } else {
          setAuthPhase("invalid")
          setAuthError("That token was rejected. Check the value and try again.")
          setAuthOpen(true)
          focusAfterPaint("secret")
        }
        return
      }

      const count = Math.max(1, Number(requestCount) || 1)
      const payloads = allPairsActive
        ? HUNIKI_LANGUAGE_PAIRS.map((pair) => ({
            ...payload,
            body: compileTranslateBody(
              defaults.shape,
              valuesForLanguagePair(values, defaults.shape.fields, pair),
              secret,
              settings.authKey,
            ),
          }))
        : Array.from({ length: count }, () => payload)
      let nextResults: TestResult[] = []

      if (sendMode === "parallel") {
        nextResults = await Promise.all(
          payloads.map((item) => postTest(item, controller.signal)),
        )
      } else {
        for (const item of payloads) {
          if (controller.signal.aborted) return
          nextResults.push(await postTest(item, controller.signal))
        }
      }

      if (controller.signal.aborted) return
      finishRequestResults(payload, nextResults)
    } catch (caught) {
      if (controller.signal.aborted || (caught instanceof DOMException && caught.name === "AbortError")) {
        return
      }
      const message = caught instanceof Error ? caught.message : "Check failed"
      if (kind === "auth") {
        setAuthPhase("invalid")
        setAuthError(message)
        setAuthOpen(true)
      } else {
        setError(message)
      }
    } finally {
      if (!controller.signal.aborted) {
        setTesting(false)
        if (kind === "auth") {
          setAuthPhase((current) => (current === "checking" ? "invalid" : current))
        }
      }
    }
  }

  function scheduleAuthCheck(value: string, touched = secretTouched) {
    window.clearTimeout(checkTimerRef.current)
    const invalidSecret = validateSecret(value)
    if (!hasEndpoint || invalidSecret) {
      lastCheckedSecret.current = ""
      setAuthPhase(invalidSecret && touched ? "invalid" : "idle")
      setAuthError(invalidSecret && touched ? invalidSecret : null)
      setAuthOpen(true)
      return
    }
    if (value === lastCheckedSecret.current && authPhase === "valid") return
    setAuthPhase("checking")
    setAuthError(null)
    checkTimerRef.current = window.setTimeout(() => {
      void run(
        {
          ...request,
          body: compileTranslateBody(defaults.shape, values, value, settings.authKey),
          auth: {
            kind: defaults.authKind,
            headerName: defaults.headerName,
            queryName: settings.authKey,
            secret: value,
          },
        },
        "auth",
      )
    }, 500)
  }

  function onSecretChange(value: string) {
    setSecret(value)
    setSecretTouched(true)
    setAuthOpen(true)
    scheduleAuthCheck(value, true)
  }

  useEffect(() => {
    if (!hasEndpoint || validateSecret(secret)) return
    scheduleAuthCheck(secret)
    return () => window.clearTimeout(checkTimerRef.current)
    // Recheck only when the endpoint changes. Body edits should not restart auth.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [url, hasEndpoint])

  function cancel() {
    abortRef.current?.abort()
    window.clearTimeout(checkTimerRef.current)
    setTesting(false)
    if (authPhase === "checking") setAuthPhase("idle")
    focusAfterPaint(authOk ? "test-request" : "secret")
  }

  function setFieldValue(key: string, value: string) {
    setValues((current) => ({ ...current, [key]: value }))
  }
  const countError = shownRequestError("count")
  function toggleAllLanguagePairs(on: boolean) {
    if (on) {
      savedRequestCountRef.current = requestCount
      setRequestCount(String(HUNIKI_LANGUAGE_PAIRS.length))
      setAllLanguagePairs(true)
      touchRequest("count")
      return
    }
    setAllLanguagePairs(false)
    setRequestCount(savedRequestCountRef.current)
  }

  function renderCustomizeField(field: BodyField) {
    const error = shownRequestError(field.role)
    const options = optionsForField(field.role)
    const value = values[field.key] ?? values[field.role] ?? ""
    const useSelect = field.role !== "text" && options.length > 0
    return (
      <Field
        key={field.key}
        data-invalid={Boolean(error) || undefined}
        className={field.role === "text" ? "sm:col-span-2" : undefined}
      >
        <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
          <FieldLabel htmlFor={field.key}>{field.label}</FieldLabel>
          {field.role === "text" ? (
            <span className="text-[11px] text-muted-foreground tabular-nums">
              {formatTextStats(value)}
            </span>
          ) : null}
        </div>
        {useSelect ? (
          <Select
            id={field.key}
            name={field.key}
            value={value || null}
            required
            items={options.map((item) => ({
              value: item.value,
              label: item.label,
            }))}
            onValueChange={(next) => {
              if (typeof next !== "string") return
              setFieldValue(field.key, next)
              touchRequest(field.role)
            }}
          >
            <SelectTrigger
              aria-invalid={Boolean(error) || undefined}
              aria-describedby={error ? `${field.key}-error` : undefined}
            >
              <SelectValue placeholder={field.label} />
            </SelectTrigger>
            <SelectContent>
              {options.map((item) => (
                <SelectItem key={item.value} value={item.value}>
                  {item.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        ) : field.role === "text" ? (
          <Textarea
            id={field.key}
            name={field.key}
            value={value}
            onChange={(event) => {
              setFieldValue(field.key, event.target.value)
              touchRequest(field.role)
            }}
            onBlur={() => touchRequest(field.role)}
            required
            placeholder={field.sample}
            aria-invalid={Boolean(error)}
            aria-describedby={error ? `${field.key}-error` : undefined}
            className="min-h-24 max-h-48 resize-y overflow-y-auto"
          />
        ) : (
          <Input
            id={field.key}
            name={field.key}
            value={value}
            onChange={(event) => {
              setFieldValue(field.key, event.target.value)
              touchRequest(field.role)
            }}
            onBlur={() => touchRequest(field.role)}
            required
            autoComplete="off"
            spellCheck={false}
            placeholder={field.sample}
            aria-invalid={Boolean(error)}
            aria-describedby={error ? `${field.key}-error` : undefined}
            className="font-mono"
          />
        )}
        {error ? <FieldError id={`${field.key}-error`}>{error}</FieldError> : null}
      </Field>
    )
  }

  return (
    <div className="space-y-8">
      <header className="space-y-2">
        <h1 className="scroll-mt-6 text-pretty text-2xl font-semibold tracking-tight">
          {APP_HEADLINE}
        </h1>
        <p className="max-w-xl text-pretty text-sm text-muted-foreground">
          {APP_DESCRIPTION}
        </p>
      </header>

      <form
        className="space-y-4"
        noValidate
        onSubmit={(event) => {
          event.preventDefault()
          submitRequest()
        }}
      >
        <Field>
          <Input
            id="endpoint-url"
            name="url"
            type="text"
            inputMode="url"
            autoComplete="url"
            spellCheck={false}
            placeholder="http://"
            value={url}
            required
            aria-label="Endpoint"
            aria-invalid={Boolean(urlError)}
            aria-describedby={urlError ? "endpoint-url-error" : undefined}
            onChange={(event) => onUrlChange(event.target.value)}
            onBlur={() => {
              const next = normalizeEndpointUrl(url)
              if (next !== url) setUrl(next)
              const invalid = next ? validateEndpointUrl(next) : "Enter an http(s) endpoint."
              setUrlError(invalid)
              if (!invalid) syncAddressBar(next)
            }}
            className="h-9"
          />
          {urlError ? <FieldError id="endpoint-url-error">{urlError}</FieldError> : null}
        </Field>

        {hasEndpoint ? (
          <section
            aria-labelledby="auth-heading"
            className="motion-enter rounded-xl border border-border bg-card"
          >
            {authOk && !authOpen ? (
              <div className="motion-enter flex items-center justify-between gap-3 px-4 py-3">
                <span id="auth-heading" className="flex items-center gap-2 text-sm font-medium">
                  <Check className="size-4 text-emerald-500" aria-hidden />
                  Provider and Authentication Token
                </span>
                <button
                  type="button"
                  aria-expanded={false}
                  aria-controls="auth-fields"
                  onClick={() => {
                    setAuthOpen(true)
                    focusAfterPaint(providerField?.key ?? "secret")
                  }}
                  className="relative inline-flex size-8 items-center justify-center rounded-md text-muted-foreground outline-none after:absolute after:-inset-1.5 hover:bg-muted hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50"
                >
                  <span className="sr-only">Expand authentication</span>
                  <ChevronDown className="size-4" aria-hidden />
                </button>
              </div>
            ) : (
              <div id="auth-fields" className="space-y-3 px-4 py-4">
                <div className="flex items-start justify-between gap-3">
                  <h2 id="auth-heading" className="text-pretty text-sm font-medium">
                    Your endpoint requires a provider and an authentication token.
                  </h2>
                  {authOk ? (
                    <button
                      type="button"
                      aria-expanded={true}
                      aria-controls="auth-fields"
                      onClick={() => setAuthOpen(false)}
                      className="relative inline-flex size-8 items-center justify-center rounded-md text-muted-foreground outline-none after:absolute after:-inset-1.5 hover:bg-muted hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50"
                    >
                      <span className="sr-only">Collapse authentication</span>
                      <ChevronDown className="size-4 rotate-180" aria-hidden />
                    </button>
                  ) : null}
                </div>
                {providerField ? (
                  <Field data-invalid={Boolean(shownRequestError("provider")) || undefined}>
                    <FieldLabel htmlFor={providerField.key}>{providerField.label}</FieldLabel>
                    <Select
                      id={providerField.key}
                      name={providerField.key}
                      value={values[providerField.key] || values.provider || null}
                      required
                      items={optionsForField("provider")}
                      onValueChange={(next) => {
                        if (typeof next !== "string") return
                        setFieldValue(providerField.key, next)
                        touchRequest("provider")
                      }}
                    >
                      <SelectTrigger
                        aria-invalid={Boolean(shownRequestError("provider")) || undefined}
                        aria-describedby={
                          shownRequestError("provider") ? `${providerField.key}-error` : undefined
                        }
                      >
                        <SelectValue placeholder={providerField.label} />
                      </SelectTrigger>
                      <SelectContent>
                        {optionsForField("provider").map((item) => (
                          <SelectItem key={item.value} value={item.value}>
                            {item.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {shownRequestError("provider") ? (
                      <FieldError id={`${providerField.key}-error`}>
                        {shownRequestError("provider")}
                      </FieldError>
                    ) : null}
                  </Field>
                ) : null}
                <Field>
                  <FieldLabel htmlFor="secret">Authentication token</FieldLabel>
                  <div className="relative">
                    <Input
                      id="secret"
                      name="secret"
                      type="text"
                      value={secret}
                      onChange={(event) => onSecretChange(event.target.value)}
                      onBlur={() => {
                        setSecretTouched(true)
                        const invalid = validateSecret(secret)
                        if (invalid) {
                          setAuthPhase("invalid")
                          setAuthError(invalid)
                        }
                      }}
                      autoComplete="off"
                      spellCheck={false}
                      required
                      placeholder="eyJhbGci…"
                      aria-invalid={authPhase === "invalid"}
                      aria-describedby={
                        authError ? "auth-error" : authPhase === "checking" ? "auth-status" : undefined
                      }
                      aria-busy={authPhase === "checking"}
                      className="pr-8 font-mono text-base md:text-xs"
                    />
                    <span className="pointer-events-none absolute top-2 right-2">
                      {authPhase === "checking" ? (
                        <LoaderCircle
                          className="size-3.5 text-muted-foreground motion-safe:animate-spin"
                          aria-hidden
                        />
                      ) : null}
                      {authOk ? (
                        <Check className="size-3.5 text-emerald-500" aria-hidden />
                      ) : null}
                    </span>
                  </div>
                  <p id="auth-status" aria-live="polite" className="sr-only">
                    {authPhase === "checking" ? "Checking token…" : authOk ? "Token accepted" : ""}
                  </p>
                  {authError ? <FieldError id="auth-error">{authError}</FieldError> : null}
                </Field>
              </div>
            )}
          </section>
        ) : null}

        {hasEndpoint && authOk ? (
          <section
            aria-labelledby="request-heading"
            className="motion-enter overflow-hidden rounded-xl border border-border bg-card"
          >
            <div>
            <h2
              id="request-heading"
              tabIndex={-1}
              className="scroll-mt-6 px-4 py-4 text-sm font-medium outline-none"
            >
              Customize your test
            </h2>
            <Separator />

            <div hidden={requestTab !== "fields"}>
              <div className="space-y-3 px-4 py-4">
                <div className="grid gap-3 sm:grid-cols-2">
                  {otherCustomizeFields.map(renderCustomizeField)}
                </div>
              </div>
              {languageFields.length > 0 ? (
                <>
                  <Separator />
                  <div className="space-y-3 px-4 py-4">
                    <div className="grid gap-3 sm:grid-cols-2">
                      {languageFields.map(renderCustomizeField)}
                    </div>
                    {canTestAllPairs ? (
                      <Field orientation="horizontal" className="w-auto">
                        <Checkbox
                          id="all-language-pairs"
                          checked={allLanguagePairs}
                          onCheckedChange={(value) => toggleAllLanguagePairs(value === true)}
                        />
                        <FieldLabel htmlFor="all-language-pairs">Test all language pairs</FieldLabel>
                      </Field>
                    ) : null}
                  </div>
                </>
              ) : null}
            </div>
            {requestTab === "fields" ? (
              <>
                <Separator />
                <div className="grid grid-cols-[5.25rem_minmax(0,1fr)] items-center gap-x-3 gap-y-3 px-4 py-4">
                  <FieldLabel htmlFor="count">Requests</FieldLabel>
                  <Field
                    orientation="horizontal"
                    data-invalid={Boolean(countError) || undefined}
                    className="w-auto flex-wrap *:data-[slot=field-label]:flex-none"
                  >
                    <Input
                      id="count"
                      name="requestCount"
                      type="number"
                      inputMode="numeric"
                      autoComplete="off"
                      required
                      min={1}
                      max={allPairsActive ? HUNIKI_LANGUAGE_PAIRS.length : MAX_REQUESTS}
                      step={1}
                      value={requestCount}
                      disabled={allPairsActive}
                      onChange={(event) => {
                        setRequestCount(event.target.value)
                        touchRequest("count")
                      }}
                      onBlur={() => touchRequest("count")}
                      aria-invalid={Boolean(countError) || undefined}
                      aria-describedby={countError ? "count-error" : undefined}
                      className="w-24 tabular-nums"
                    />
                    {countError ? (
                      <FieldError id="count-error" className="basis-full">
                        {countError}
                      </FieldError>
                    ) : null}
                  </Field>
                  {isMultipleRequests(requestCount) ? (
                    <>
                      <span id="sequence-label" className="text-sm font-medium">
                        Sequence
                      </span>
                      <div
                        role="radiogroup"
                        aria-labelledby="sequence-label"
                        className="motion-enter flex flex-wrap gap-2"
                      >
                        {(
                          [
                            ["sequential", "Sequential"],
                            ["parallel", "Concurrent"],
                          ] as const
                        ).map(([value, label]) => (
                          <label key={value} className={`${CHOICE_CHIP} shrink-0 whitespace-nowrap`}>
                            <input
                              type="radio"
                              name="sendMode"
                              value={value}
                              checked={sendMode === value}
                              className={CHOICE_RADIO}
                              onChange={() => setSendMode(value)}
                            />
                            {label}
                          </label>
                        ))}
                      </div>
                    </>
                  ) : null}
                </div>
              </>
            ) : (
              <RequestPreviewList curls={previewCurls} />
            )}

            </div>
            {error ? (
              <FieldError id="test-error" className="px-4 pt-2">
                {error}
              </FieldError>
            ) : null}
            <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border px-4 py-3">
              <Button
                type="button"
                variant="outline"
                onClick={() => setRequestTab(requestTab === "fields" ? "preview" : "fields")}
              >
                {requestTab === "fields" ? "Preview requests" : "Edit fields"}
              </Button>
              <span className="flex flex-wrap items-center gap-2">
                {testing ? (
                  <Button type="button" variant="outline" onClick={cancel}>
                    Cancel
                  </Button>
                ) : null}
                <Button
                  id="test-request"
                  type="submit"
                  aria-busy={testing}
                  disabled={testing}
                >
                  {testing ? "Running..." : result ? "Retest" : "Submit"}
                </Button>
              </span>
            </div>
          </section>
        ) : null}

      {hasEndpoint && authOk && result ? (
        <section
          id="result-heading"
          tabIndex={-1}
          className="motion-enter scroll-mt-20 space-y-4 rounded-xl border border-border bg-card p-6 outline-none"
          aria-labelledby="result-title"
        >
          <header className="space-y-3">
            <h2
              id="result-title"
              className="text-pretty text-xl/6 font-semibold"
            >
              {resultCardTitle(result, averageMs)}
            </h2>
            {result.diagnosis.next ? (
              <p className="text-pretty text-sm">{result.diagnosis.next}</p>
            ) : null}
            {result.shapeChange ? (
              <p className="text-pretty text-sm text-amber-600 dark:text-amber-400">
                {result.shapeChange}
              </p>
            ) : null}
            {runs.length > 1 ? (
              <RunResultsTable
                runs={runs}
                selectedIndex={selectedRunIndex}
                onSelect={setSelectedRunIndex}
              />
            ) : null}
          </header>

          <div className="space-y-3">
            <h3 className="text-sm font-medium">At a glance</h3>
            <ul className="space-y-2">
              {HEALTH_CHECKS.map((check) => {
                const value = result.health[check.key]
                return (
                  <li key={check.key} className="flex items-start gap-2 text-sm">
                    <HealthStatus value={value} />
                    <p className="flex items-start gap-1 text-pretty">
                      {explainHealth(check.key, result, averageMs)}
                      <InfoTip label={check.tipLabel}>{check.tip}</InfoTip>
                    </p>
                  </li>
                )
              })}
            </ul>
          </div>

          {selectedResult?.response ? (
            <div className="space-y-3">
              <div className="space-y-1">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h3 className="text-sm font-medium">Response details</h3>
                  {runs.length > 1 ? (
                    <Select
                      value={String(selectedRunIndex)}
                      items={runs.map((_, index) => ({
                        value: String(index),
                        label: `Request ${index + 1}`,
                      }))}
                      onValueChange={(next) => {
                        if (typeof next !== "string") return
                        setSelectedRunIndex(Number(next))
                      }}
                    >
                      <SelectTrigger
                        size="sm"
                        aria-label="Request to inspect"
                        className="w-auto min-w-32"
                      >
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {runs.map((_, index) => (
                          <SelectItem key={index} value={String(index)}>
                            Request {index + 1}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  ) : null}
                </div>
                <p className="font-mono text-sm">
                  {selectedResult.response.status} {selectedResult.response.statusText}
                  <span className="tabular-nums text-muted-foreground">
                    {" "}
                    · {formatMs(selectedResult.response.durationMs)}
                  </span>
                </p>
              </div>
              <CodeBlock className="max-h-64" code={prettyBody || "(empty body)"} />
              <details className="group">
                <summary className="flex cursor-pointer list-none items-center gap-1.5 rounded-sm text-xs text-muted-foreground focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none [&::-webkit-details-marker]:hidden">
                  <ChevronDown
                    aria-hidden
                    className="size-3.5 shrink-0 transition-transform duration-[160ms] ease-out -rotate-90 group-open:rotate-0"
                  />
                  Response headers
                </summary>
                <CodeBlock
                  className="mt-2 overflow-visible"
                  code={JSON.stringify(selectedResult.response.headers, null, 2)}
                />
              </details>
            </div>
          ) : null}
        </section>
      ) : null}
      </form>
    </div>
  )
}
