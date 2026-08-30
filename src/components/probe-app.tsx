"use client"

import { useEffect, useId, useLayoutEffect, useMemo, useRef, useState } from "react"
import { Check, ChevronDown, CircleHelp, LoaderCircle, TriangleAlert, X } from "lucide-react"

import { CodeBlock } from "@/components/code-block"
import { useSavedTests } from "@/components/saved-tests-context"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Field, FieldDescription, FieldError, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { collectShape, parseJson } from "@/lib/probe/assert"
import {
  DEFAULT_GAP_MS,
  DEFAULT_LATENCY_MS,
  DEFAULT_REQUEST_COUNT,
  MAX_GAP_MS,
  MAX_REQUESTS,
  RUN_TIMEOUT_MAX_MS,
} from "@/lib/probe/constants"
import {
  compileTranslateBody,
  inferDefaults,
  translateBodyKeys,
  valuesFromShape,
  type BodyFieldRole,
  type FieldValues,
} from "@/lib/probe/defaults"
import {
  inferLanguagesUrl,
  languagePairOptions,
  parseLanguages,
  type LanguageOption,
} from "@/lib/probe/languages"
import { formatMs } from "@/lib/format"
import { buildCurl } from "@/lib/probe/preview"
import { validateEndpointUrl } from "@/lib/probe/url-client"
import {
  validateRequestForm,
  validateSecret,
  type RequestFieldId,
} from "@/lib/probe/validate-form"
import type {
  Assertion,
  AuthKind,
  Dimension,
  HistoryEntry,
  SendMode,
  TestRequest,
  TestResult,
} from "@/lib/probe/types"

type AuthPhase = "idle" | "checking" | "valid" | "invalid"

const CHOICE_CHIP =
  "inline-flex h-8 cursor-pointer items-center gap-1.5 rounded-lg border border-border px-2.5 text-sm has-[:focus-visible]:border-ring has-[:focus-visible]:ring-3 has-[:focus-visible]:ring-ring/50"

const CHOICE_RADIO =
  "size-3.5 appearance-none rounded-full border border-zinc-300 bg-transparent dark:border-zinc-600 checked:border-zinc-400 checked:bg-[radial-gradient(circle,theme(colors.zinc.400)_38%,transparent_42%)] dark:checked:border-zinc-500 dark:checked:bg-[radial-gradient(circle,theme(colors.zinc.400)_38%,transparent_42%)]"

const SELECT_CLASS =
  "h-8 w-full min-w-0 rounded-lg border border-input bg-transparent px-2.5 py-1 font-mono text-base transition-colors outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:pointer-events-none disabled:cursor-not-allowed disabled:bg-input/50 disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-3 aria-invalid:ring-destructive/20 md:text-sm dark:bg-input/30 dark:aria-invalid:border-destructive/50 dark:aria-invalid:ring-destructive/40"

function optionsForLanguageField(role: BodyFieldRole, languages: LanguageOption[]) {
  if (role === "text") return []
  if (role === "lang") return languagePairOptions(languages)
  return languages
}

function optionLabel(option: LanguageOption) {
  return option.name === option.code ? option.code : `${option.name} (${option.code})`
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
    tip: "How long the provider took. Over the threshold counts as degraded even if the body is correct.",
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

function resultCardTitle(result: TestResult) {
  const duration = result.response ? formatMs(result.response.durationMs) : null
  if (result.overall === "healthy" || result.overall === "degraded") {
    return duration ? `Your request succeeded in ${duration}` : "Your request succeeded"
  }
  return result.diagnosis.title
}

function explainHealth(
  key: (typeof HEALTH_CHECKS)[number]["key"],
  result: TestResult,
  latencyMs: string,
): string {
  const status = result.response?.status
  const duration = result.response?.durationMs
  const threshold = Number(latencyMs) || DEFAULT_LATENCY_MS
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
    return `The response arrived in ${formatMs(duration)}, under the ${threshold} ms threshold`
  }
  if (value === "warn" && duration != null) {
    return `The response took ${formatMs(duration)}, over the ${threshold} ms threshold`
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
          className={
            align === "end"
              ? "absolute top-[calc(100%+6px)] right-0 z-50 w-64 rounded-md border border-border bg-popover px-3 py-2 text-xs leading-relaxed text-pretty text-popover-foreground shadow-md"
              : "absolute top-[calc(100%+6px)] left-0 z-50 w-64 rounded-md border border-border bg-popover px-3 py-2 text-xs leading-relaxed text-pretty text-popover-foreground shadow-md"
          }
        >
          {children}
        </span>
      ) : null}
    </span>
  )
}

function LabelTip({
  htmlFor,
  label,
  tipLabel,
  children,
}: {
  htmlFor: string
  label: string
  tipLabel: string
  children: string
}) {
  return (
    <div className="flex items-center gap-1.5">
      <FieldLabel htmlFor={htmlFor}>{label}</FieldLabel>
      <InfoTip label={tipLabel}>{children}</InfoTip>
    </div>
  )
}

export function ProbeApp({ initialUrl }: { initialUrl: string }) {
  const abortRef = useRef<AbortController | null>(null)
  const languagesAbortRef = useRef<AbortController | null>(null)
  const pendingFocusRef = useRef<string | null>(null)
  const checkTimerRef = useRef<number>(0)
  const lastCheckedSecret = useRef("")
  const { saveTest, pendingLoad, consumePendingLoad } = useSavedTests()
  const inferred = inferDefaults(initialUrl)

  const [url, setUrl] = useState(initialUrl)
  const method = "POST" as const
  const [urlError, setUrlError] = useState<string | null>(
    initialUrl ? validateEndpointUrl(initialUrl) : null,
  )
  const [authKind, setAuthKind] = useState<AuthKind>(inferred.authKind)
  const [headerName, setHeaderName] = useState(inferred.headerName)
  const queryName = "api_key"
  const [secret, setSecret] = useState("")
  const [authPhase, setAuthPhase] = useState<AuthPhase>("idle")
  const [authOpen, setAuthOpen] = useState(true)
  const [authError, setAuthError] = useState<string | null>(null)
  const [contentType, setContentType] = useState("application/json")
  const [extraHeader, setExtraHeader] = useState({ key: "", value: "" })
  const [values, setValues] = useState<FieldValues>(() => valuesFromShape(inferred.shape))
  const [languages, setLanguages] = useState<LanguageOption[]>([])
  const [languagesLoading, setLanguagesLoading] = useState(false)
  const [rawBody, setRawBody] = useState("")
  const [rawMode, setRawMode] = useState(false)
  const [latencyMs, setLatencyMs] = useState(String(DEFAULT_LATENCY_MS))
  const [requestCount, setRequestCount] = useState(String(DEFAULT_REQUEST_COUNT))
  const [sendMode, setSendMode] = useState<SendMode>("sequential")
  const [gapMs, setGapMs] = useState(String(DEFAULT_GAP_MS))
  const [assertions, setAssertions] = useState<Assertion[]>([])
  const [result, setResult] = useState<TestResult | null>(null)
  const [runs, setRuns] = useState<TestResult[]>([])
  const [history, setHistory] = useState<HistoryEntry[]>([])
  const [previousShape, setPreviousShape] = useState<string[]>([])
  const [testing, setTesting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [secretTouched, setSecretTouched] = useState(false)
  const [requestTouched, setRequestTouched] = useState<Partial<Record<RequestFieldId, boolean>>>({})
  const [requestErrorsVisible, setRequestErrorsVisible] = useState(false)

  const defaults = useMemo(() => inferDefaults(url), [url])
  const defaultBody = compileTranslateBody(defaults.shape, values)
  const bodyText = rawMode ? rawBody || defaultBody : defaultBody
  const hasEndpoint = url.trim().length > 0 && !urlError
  const authOk = authPhase === "valid"
  const requestValidation = useMemo(
    () =>
      validateRequestForm({
        method,
        bodyKind: defaults.bodyKind,
        fields: defaults.shape.fields,
        rawMode,
        values,
        rawBody,
        defaultBody,
        contentType,
        latencyMs,
        requestCount,
        sendMode,
        gapMs,
      }),
    [
      contentType,
      defaultBody,
      defaults.bodyKind,
      defaults.shape.fields,
      gapMs,
      latencyMs,
      method,
      rawBody,
      rawMode,
      requestCount,
      sendMode,
      values,
    ],
  )

  const request: TestRequest = useMemo(
    () => ({
      url: url.trim(),
      method,
      auth: secret
        ? { kind: authKind, headerName, queryName, secret }
        : undefined,
      headers: {
        ...(contentType ? { "Content-Type": contentType } : {}),
        ...(extraHeader.key && extraHeader.value
          ? { [extraHeader.key]: extraHeader.value }
          : {}),
      },
      body: defaults.bodyKind !== "none" ? bodyText : undefined,
      assertions,
      latencyMs: Number(latencyMs) || DEFAULT_LATENCY_MS,
    }),
    [
      assertions,
      authKind,
      bodyText,
      contentType,
      defaults.bodyKind,
      extraHeader,
      headerName,
      latencyMs,
      method,
      queryName,
      secret,
      url,
    ],
  )

  const curl = useMemo(() => buildCurl(request, true), [request])
  const prettyBody = useMemo(
    () => (result?.response ? pretty(result.response.body) : ""),
    [result],
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
      languagesAbortRef.current?.abort()
      window.clearTimeout(checkTimerRef.current)
    }
  }, [])

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
    setResult(null)
    setRuns([])
    if (value.trim()) {
      const next = inferDefaults(value)
      setHeaderName(next.headerName)
      setAuthKind(next.authKind)
      setValues(valuesFromShape(next.shape))
      setLanguages([])
      setLanguagesLoading(false)
      setRawBody("")
      setRawMode(false)
    }
  }

  useEffect(() => {
    if (!pendingLoad) return
    const loaded = consumePendingLoad()
    if (!loaded) return
    onUrlChange(loaded.url)
    const next = inferDefaults(loaded.url)
    setHeaderName(next.headerName)
    setAuthKind(next.authKind)
    syncAddressBar(loaded.url)
    focusAfterPaint("endpoint-url")
  }, [consumePendingLoad, pendingLoad])

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

    const { firstId } = requestValidation
    if (firstId) {
      setRequestErrorsVisible(true)
      if (firstId === "raw-body") setRawMode(true)
      if (firstId === "text" || firstId === "source" || firstId === "target" || firstId === "lang") {
        setRawMode(false)
        const field = defaults.shape.fields.find((item) => item.role === firstId)
        focusAfterPaint(field?.key ?? firstId)
        return
      }
      focusAfterPaint(firstId)
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

  useEffect(() => {
    if (!authOk || !hasEndpoint) {
      setLanguages([])
      setLanguagesLoading(false)
      return
    }

    const languagesUrl = inferLanguagesUrl(url)
    if (!languagesUrl) {
      setLanguages([])
      setLanguagesLoading(false)
      return
    }

    const controller = new AbortController()
    languagesAbortRef.current?.abort()
    languagesAbortRef.current = controller
    setLanguagesLoading(true)

    void postTest(
      {
        url: languagesUrl,
        method: "GET",
        auth: secret ? { kind: authKind, headerName, queryName, secret } : undefined,
        headers: {},
        assertions: [],
        latencyMs: DEFAULT_LATENCY_MS,
      },
      controller.signal,
    )
      .then((next) => {
        if (controller.signal.aborted) return
        setLanguages(parseLanguages(next.response?.body ?? ""))
      })
      .catch(() => {
        if (controller.signal.aborted) return
        setLanguages([])
      })
      .finally(() => {
        if (!controller.signal.aborted) setLanguagesLoading(false)
      })

    return () => controller.abort()
    // Fetch whenever the accepted token or endpoint changes. Do not treat this as a submitted check.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authOk, authKind, hasEndpoint, headerName, secret, url])

  function finishRequestResults(payload: TestRequest, nextResults: TestResult[]) {
    const next = nextResults.at(-1)
    if (!next) return
    setRuns(nextResults)
    setResult(next)
    if (next.response) {
      setPreviousShape(collectShape(next.response.body))
    }
    const durations = nextResults
      .map((item) => item.response?.durationMs)
      .filter((value): value is number => typeof value === "number")
    setHistory((current) =>
      [
        {
          id: crypto.randomUUID(),
          at: Date.now(),
          status: next.response?.status,
          durationMs: durations.length ? Math.max(...durations) : 0,
          overall: next.overall,
        },
        ...current,
      ].slice(0, 5),
    )
    saveTest({
      url: payload.url,
      method: payload.method,
      overall: next.overall,
      title: next.diagnosis.title,
      explanation: next.diagnosis.explanation,
      status: next.response?.status,
      durationMs: next.response?.durationMs ?? 0,
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
      const gap = Math.max(0, Number(gapMs) || 0)
      let nextResults: TestResult[] = []

      if (sendMode === "parallel") {
        nextResults = await Promise.all(
          Array.from({ length: count }, () => postTest(payload, controller.signal)),
        )
      } else {
        for (let index = 0; index < count; index += 1) {
          if (controller.signal.aborted) return
          if (index > 0 && sendMode === "delayed") {
            await new Promise<void>((resolve, reject) => {
              const timer = window.setTimeout(resolve, gap)
              const onAbort = () => {
                window.clearTimeout(timer)
                reject(new DOMException("Aborted", "AbortError"))
              }
              if (controller.signal.aborted) {
                onAbort()
                return
              }
              controller.signal.addEventListener("abort", onAbort, { once: true })
            })
          }
          nextResults.push(await postTest(payload, controller.signal))
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
      void run({ ...request, auth: { kind: authKind, headerName, queryName, secret: value } }, "auth")
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

  function toggleAssertion(assertion: Assertion, on: boolean) {
    setAssertions((current) => {
      const without = current.filter((item) => item.path !== assertion.path)
      return on ? [...without, assertion] : without
    })
  }

  function setFieldValue(role: BodyFieldRole, value: string) {
    setValues((current) => ({ ...current, [role]: value }))
  }
  const rawBodyError = shownRequestError("raw-body")
  const contentTypeError = shownRequestError("content-type")
  const latencyError = shownRequestError("latency")
  const countError = shownRequestError("count")
  const gapError = shownRequestError("gap")

  return (
    <div className="space-y-8">
      <header className="space-y-2">
        <h1 className="text-pretty text-2xl font-semibold tracking-tight">
          Run a custom check on an endpoint
        </h1>
        <p className="max-w-xl text-pretty text-sm text-muted-foreground">
          Create custom requests to test an endpoint for your workflow.
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
            type="url"
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
              const invalid = validateEndpointUrl(url)
              setUrlError(invalid)
              if (!invalid) syncAddressBar(url)
            }}
            className="font-mono text-xs md:text-xs"
          />
          {urlError ? <FieldError id="endpoint-url-error">{urlError}</FieldError> : null}
        </Field>

        {hasEndpoint ? (
          <section
            aria-labelledby="auth-heading"
            className="rounded-xl border border-border bg-card"
          >
            {authOk && !authOpen ? (
              <div className="flex items-center justify-between gap-3 px-4 py-3">
                <span id="auth-heading" className="flex items-center gap-2 text-sm font-medium">
                  <Check className="size-4 text-emerald-500" aria-hidden />
                  Authentication Token
                  <InfoTip label="About authentication tokens">
                    A secret the provider issued for this product. We send it with the request and
                    check whether the service accepts it.
                  </InfoTip>
                </span>
                <button
                  type="button"
                  aria-expanded={false}
                  aria-controls="auth-fields"
                  onClick={() => {
                    setAuthOpen(true)
                    focusAfterPaint("secret")
                  }}
                  className="rounded-sm text-muted-foreground outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
                >
                  <span className="sr-only">Expand authentication</span>
                  <ChevronDown className="size-4" aria-hidden />
                </button>
              </div>
            ) : (
              <div id="auth-fields" className="space-y-3 px-4 py-4">
                <div className="flex items-start justify-between gap-3">
                  <h2 id="auth-heading" className="flex items-start gap-1.5 text-pretty text-sm font-medium">
                    Your endpoint requires an authentication token.
                    <InfoTip label="About authentication tokens">
                      A secret the provider issued for this product. We send it with the request and
                      check whether the service accepts it.
                    </InfoTip>
                  </h2>
                  {authOk ? (
                    <button
                      type="button"
                      aria-expanded={true}
                      aria-controls="auth-fields"
                      onClick={() => setAuthOpen(false)}
                      className="rounded-sm text-muted-foreground outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
                    >
                      <span className="sr-only">Collapse authentication</span>
                      <ChevronDown className="size-4 rotate-180" aria-hidden />
                    </button>
                  ) : null}
                </div>
                <Field>
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
                      aria-label="Authentication token"
                      aria-invalid={authPhase === "invalid"}
                      aria-describedby={
                        authError ? "auth-error" : authPhase === "checking" ? "auth-status" : undefined
                      }
                      aria-busy={authPhase === "checking"}
                      className="pr-8 font-mono text-xs md:text-xs"
                    />
                    <span className="pointer-events-none absolute top-2 right-2">
                      {authPhase === "checking" ? (
                        <LoaderCircle
                          className="size-3.5 animate-spin text-muted-foreground"
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
            className="space-y-4 rounded-xl border border-border bg-card px-4 py-4"
          >
            <div className="space-y-1">
              <h2
                id="request-heading"
                tabIndex={-1}
                className="flex items-center gap-1.5 text-sm font-medium outline-none"
              >
                Customize your check
                <InfoTip label="About this check">
                  Change the sample we send. Use this to see if the service still works for the
                  phrase and languages you care about.
                </InfoTip>
              </h2>
              <p className="text-pretty text-sm text-muted-foreground">
                Customize your request and payload
              </p>
            </div>

            <div className="space-y-3">
                <div className="flex justify-end">
                  <Button
                    type="button"
                    variant="ghost"
                    size="xs"
                    aria-pressed={rawMode}
                    onClick={() => setRawMode((on) => !on)}
                  >
                    {rawMode ? "Use fields" : "Edit JSON"}
                  </Button>
                </div>
                    {rawMode ? (
                      <Field data-invalid={Boolean(rawBodyError) || undefined}>
                        <LabelTip
                          htmlFor="raw-body"
                          label="JSON"
                          tipLabel="About the JSON"
                        >
                          {`The raw body we send. Keys for this API are ${translateBodyKeys(
                            defaults.shape,
                          ).join(", ")}.`}
                        </LabelTip>
                        <Textarea
                          id="raw-body"
                          name="rawBody"
                          value={rawBody || defaultBody}
                          onChange={(event) => {
                            setRawBody(event.target.value)
                            touchRequest("raw-body")
                          }}
                          onBlur={() => touchRequest("raw-body")}
                          required
                          spellCheck={false}
                          aria-invalid={Boolean(rawBodyError)}
                          aria-describedby={rawBodyError ? "raw-body-error" : undefined}
                          className="min-h-32 font-mono text-xs"
                        />
                        {rawBodyError ? (
                          <FieldError id="raw-body-error">{rawBodyError}</FieldError>
                        ) : null}
                      </Field>
                    ) : (
                      <div className="grid gap-3 sm:grid-cols-2">
                        {defaults.shape.fields.map((field) => {
                          const error = shownRequestError(field.role)
                          const options = optionsForLanguageField(field.role, languages)
                          const value = values[field.role]
                          const useSelect =
                            field.role !== "text" && (options.length > 0 || languagesLoading)
                          return (
                            <Field
                              key={field.key}
                              data-invalid={Boolean(error) || undefined}
                              className={field.role === "text" ? "sm:col-span-2" : undefined}
                            >
                              <LabelTip
                                htmlFor={field.key}
                                label={field.label}
                                tipLabel={`About ${field.label}`}
                              >
                                {field.tip}
                              </LabelTip>
                              {useSelect ? (
                                <select
                                  id={field.key}
                                  name={field.key}
                                  value={value}
                                  required
                                  disabled={languagesLoading && options.length === 0}
                                  aria-busy={languagesLoading || undefined}
                                  aria-invalid={Boolean(error)}
                                  aria-describedby={error ? `${field.key}-error` : undefined}
                                  onChange={(event) => {
                                    setFieldValue(field.role, event.target.value)
                                    touchRequest(field.role)
                                  }}
                                  onBlur={() => touchRequest(field.role)}
                                  className={SELECT_CLASS}
                                >
                                  {languagesLoading && options.length === 0 ? (
                                    <option value={value}>{value || "Loading languages…"}</option>
                                  ) : null}
                                  {value && !options.some((item) => item.code === value) ? (
                                    <option value={value}>{value}</option>
                                  ) : null}
                                  {options.map((item) => (
                                    <option key={item.code} value={item.code}>
                                      {optionLabel(item)}
                                    </option>
                                  ))}
                                </select>
                              ) : (
                                <Input
                                  id={field.key}
                                  name={field.key}
                                  value={value}
                                  onChange={(event) => {
                                    setFieldValue(field.role, event.target.value)
                                    touchRequest(field.role)
                                  }}
                                  onBlur={() => touchRequest(field.role)}
                                  required
                                  autoComplete={field.role === "text" ? undefined : "off"}
                                  spellCheck={field.role === "text" ? undefined : false}
                                  placeholder={field.sample}
                                  aria-invalid={Boolean(error)}
                                  aria-describedby={error ? `${field.key}-error` : undefined}
                                  className={field.role === "text" ? undefined : "font-mono"}
                                />
                              )}
                              {error ? (
                                <FieldError id={`${field.key}-error`}>{error}</FieldError>
                              ) : null}
                            </Field>
                          )
                        })}
                      </div>
                    )}
                    <Field data-invalid={Boolean(contentTypeError) || undefined}>
                      <LabelTip
                        htmlFor="content-type"
                        label="Format"
                        tipLabel="About the format"
                      >
                        How the body is encoded. Most translation APIs expect application/json.
                      </LabelTip>
                      <Input
                        id="content-type"
                        name="contentType"
                        value={contentType}
                        onChange={(event) => {
                          setContentType(event.target.value)
                          touchRequest("content-type")
                        }}
                        onBlur={() => touchRequest("content-type")}
                        required
                        autoComplete="off"
                        spellCheck={false}
                        aria-invalid={Boolean(contentTypeError)}
                        aria-describedby={contentTypeError ? "content-type-error" : undefined}
                        className="max-w-xs font-mono"
                      />
                      {contentTypeError ? (
                        <FieldError id="content-type-error">{contentTypeError}</FieldError>
                      ) : null}
                    </Field>
                <div className="grid gap-3 sm:grid-cols-2">
                  <Field data-invalid={Boolean(countError) || undefined}>
                    <LabelTip htmlFor="count" label="Requests" tipLabel="About how many requests">
                      How many times to send this check. Use more than one to see if it stays
                      reliable.
                    </LabelTip>
                    <Input
                      id="count"
                      name="requestCount"
                      type="number"
                      inputMode="numeric"
                      autoComplete="off"
                      required
                      min={1}
                      max={MAX_REQUESTS}
                      step={1}
                      value={requestCount}
                      onChange={(event) => {
                        setRequestCount(event.target.value)
                        touchRequest("count")
                      }}
                      onBlur={() => touchRequest("count")}
                      aria-invalid={Boolean(countError)}
                      aria-describedby={countError ? "count-error" : undefined}
                      className="max-w-32 tabular-nums"
                    />
                    {countError ? <FieldError id="count-error">{countError}</FieldError> : null}
                  </Field>
                  <Field data-invalid={Boolean(latencyError) || undefined}>
                    <LabelTip
                      htmlFor="latency"
                      label="Maximum delay"
                      tipLabel="About the maximum delay"
                    >
                      If a response takes longer than this, we mark it slow even when the body is
                      correct.
                    </LabelTip>
                    <Input
                      id="latency"
                      name="latency"
                      type="number"
                      inputMode="numeric"
                      autoComplete="off"
                      required
                      min={1}
                      max={RUN_TIMEOUT_MAX_MS}
                      step={1}
                      value={latencyMs}
                      onChange={(event) => {
                        setLatencyMs(event.target.value)
                        touchRequest("latency")
                      }}
                      onBlur={() => touchRequest("latency")}
                      aria-invalid={Boolean(latencyError)}
                      aria-describedby={latencyError ? "latency-error" : undefined}
                      className="max-w-32 tabular-nums"
                    />
                    {latencyError ? <FieldError id="latency-error">{latencyError}</FieldError> : null}
                  </Field>
                </div>
                <fieldset>
                  <legend className="mb-2 flex items-center gap-1.5 text-sm font-medium">
                    How to send them
                    <InfoTip label="About how to send them">
                      One by one waits for each response. In parallel sends them together. With a
                      delay waits between each send.
                    </InfoTip>
                  </legend>
                  <div className="flex flex-wrap gap-2">
                    {(
                      [
                        ["sequential", "One by one"],
                        ["parallel", "In parallel"],
                        ["delayed", "With a delay"],
                      ] as const
                    ).map(([value, label]) => (
                      <label
                        key={value}
                        className={CHOICE_CHIP}
                      >
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
                </fieldset>
                {sendMode === "delayed" ? (
                  <Field data-invalid={Boolean(gapError) || undefined}>
                    <LabelTip
                      htmlFor="gap"
                      label="Delay between requests (ms)"
                      tipLabel="About the delay between requests"
                    >
                      How long to wait after one response before sending the next.
                    </LabelTip>
                    <Input
                      id="gap"
                      name="gapMs"
                      type="number"
                      inputMode="numeric"
                      autoComplete="off"
                      required
                      min={0}
                      max={MAX_GAP_MS}
                      step={1}
                      value={gapMs}
                      onChange={(event) => {
                        setGapMs(event.target.value)
                        touchRequest("gap")
                      }}
                      onBlur={() => touchRequest("gap")}
                      aria-invalid={Boolean(gapError)}
                      aria-describedby={gapError ? "gap-error" : undefined}
                      className="max-w-32 tabular-nums"
                    />
                    {gapError ? <FieldError id="gap-error">{gapError}</FieldError> : null}
                  </Field>
                ) : null}
                <details className="overscroll-contain">
                  <summary className="cursor-pointer rounded-sm text-xs text-muted-foreground focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none">
                    What we will send
                  </summary>
                  <pre
                    translate="no"
                    tabIndex={0}
                    className="mt-2 max-h-40 overflow-auto overscroll-contain rounded-lg border border-border bg-zinc-50 px-3 py-2 font-mono text-xs break-words whitespace-pre-wrap focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 dark:bg-zinc-950/60"
                  >
                    {curl}
                  </pre>
                </details>
              </div>

            <div className="flex flex-wrap items-center gap-2">
              <Button
                id="test-request"
                type="submit"
                aria-busy={testing}
                disabled={testing}
              >
                {result ? "Retest" : "Submit"}
              </Button>
              {testing ? (
                <Button type="button" variant="outline" onClick={cancel}>
                  Cancel
                </Button>
              ) : null}
            </div>
            <p aria-live="polite" className="text-sm text-muted-foreground">
              {testing
                ? Number(requestCount) > 1
                  ? `Running ${requestCount} checks…`
                  : "Running the check…"
                : "\u00a0"}
            </p>
            {error ? <FieldError id="test-error">{error}</FieldError> : null}
          </section>
        ) : null}

      {hasEndpoint && authOk && result ? (
        <section
          className="scroll-mt-20 space-y-6 rounded-xl border border-border bg-zinc-50 p-6 dark:bg-zinc-900"
          aria-labelledby="result-heading"
        >
          <header className="space-y-1">
            <h2
              id="result-heading"
              tabIndex={-1}
              className="text-pretty text-xl font-semibold outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
            >
              {resultCardTitle(result)}
            </h2>
            <p className="text-pretty text-sm text-muted-foreground">Results below</p>
            {result.diagnosis.next ? (
              <p className="pt-2 text-pretty text-sm">{result.diagnosis.next}</p>
            ) : null}
            {result.shapeChange ? (
              <p className="text-pretty text-sm text-amber-600 dark:text-amber-400">
                {result.shapeChange}
              </p>
            ) : null}
            {runs.length > 1 ? (
              <ol className="space-y-1 pt-2 font-mono text-xs tabular-nums text-muted-foreground">
                {runs.map((item, index) => (
                  <li key={`${item.response?.durationMs ?? 0}-${index}`}>
                    {index + 1}. {item.response?.status ?? "—"} ·{" "}
                    {item.response ? formatMs(item.response.durationMs) : "—"} · {item.overall}
                  </li>
                ))}
              </ol>
            ) : null}
          </header>

          <div className="space-y-3">
            <h3 className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
              What we checked
            </h3>
            <ul className="space-y-2">
              {HEALTH_CHECKS.map((check) => {
                const value = result.health[check.key]
                return (
                  <li key={check.key} className="flex items-start gap-2 text-sm">
                    <HealthStatus value={value} />
                    <p className="flex items-start gap-1 text-pretty">
                      {explainHealth(check.key, result, latencyMs)}
                      <InfoTip label={check.tipLabel}>{check.tip}</InfoTip>
                    </p>
                  </li>
                )
              })}
            </ul>
          </div>

          {result.response ? (
            <div className="space-y-3">
              <div className="space-y-1">
                <h3 className="text-sm font-medium">What came back</h3>
                <p className="font-mono text-sm">
                  {result.response.status} {result.response.statusText}
                  <span className="tabular-nums text-muted-foreground">
                    {" "}
                    · {formatMs(result.response.durationMs)}
                  </span>
                </p>
              </div>
              <CodeBlock className="max-h-64" code={prettyBody || "(empty body)"} />
              <details className="overscroll-contain">
                <summary className="cursor-pointer rounded-sm text-xs text-muted-foreground focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none">
                  Response headers
                </summary>
                <CodeBlock
                  className="mt-2 max-h-64"
                  code={JSON.stringify(result.response.headers, null, 2)}
                />
              </details>
            </div>
          ) : null}

          {result.suggestedAssertions.length > 0 || assertions.length > 0 ? (
            <fieldset>
              <legend className="mb-2 flex items-center gap-1.5 text-sm font-medium">
                Require these fields
                <InfoTip label="About required fields">
                  On the next test, fail if these JSON paths are missing or empty.
                </InfoTip>
              </legend>
              <div className="flex flex-wrap gap-3">
                {[...result.suggestedAssertions, ...assertions]
                  .filter(
                    (item, index, all) =>
                      all.findIndex((other) => other.path === item.path) === index,
                  )
                  .map((assertion) => {
                    const id = `assert-${assertion.path}`
                    const checked = assertions.some((item) => item.path === assertion.path)
                    return (
                      <Field key={assertion.path} orientation="horizontal" className="w-auto">
                        <Checkbox
                          id={id}
                          checked={checked}
                          onCheckedChange={(value) => toggleAssertion(assertion, value === true)}
                        />
                        <FieldLabel htmlFor={id} className="font-normal font-mono">
                          {assertion.path} is {assertion.kind === "nonempty" ? "non-empty" : "present"}
                        </FieldLabel>
                      </Field>
                    )
                  })}
              </div>
              {result.suggestedAssertions[0] ? (
                <FieldDescription>
                  It looks like {result.suggestedAssertions[0].path} contains the output. Require
                  this field?
                </FieldDescription>
              ) : null}
            </fieldset>
          ) : null}
        </section>
      ) : null}
      </form>

      {hasEndpoint && authOk && history.length > 0 ? (
        <section
          aria-labelledby="history-heading"
          className="rounded-xl border border-border bg-card px-4 py-4"
        >
          <h2
            id="history-heading"
            className="mb-2 flex items-center gap-1.5 scroll-mt-20 text-xs font-medium tracking-wide text-muted-foreground uppercase"
          >
            This session
            <InfoTip label="About this session">
              Recent tests in this browser tab. Nothing is stored after you leave.
            </InfoTip>
          </h2>
          <ol className="space-y-1 font-mono text-xs">
            {history.map((entry) => (
              <li key={entry.id} className="tabular-nums">
                {entry.status ?? "—"} · {formatMs(entry.durationMs)} · {entry.overall}
              </li>
            ))}
          </ol>
        </section>
      ) : null}
    </div>
  )
}
