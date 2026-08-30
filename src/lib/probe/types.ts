export type RequestMethod = "GET" | "POST"

export type SendMode = "sequential" | "parallel"

export type AuthKind = "bearer" | "api_key" | "query" | "body"

export type AuthConfig = {
  kind: AuthKind
  headerName: string
  queryName: string
  secret: string
}

export type AssertionKind = "exists" | "nonempty"

export type Assertion = {
  path: string
  kind: AssertionKind
}

export type Classification =
  | "ok"
  | "dns"
  | "network"
  | "timeout"
  | "auth"
  | "not_found"
  | "rate_limit"
  | "bad_request"
  | "provider_error"
  | "unexpected"
  | "slow"

export type Dimension = "pass" | "warn" | "fail" | "unknown"

export type HealthDimensions = {
  reachable: Dimension
  authenticated: Dimension
  requestValid: Dimension
  expectedOutput: Dimension
  latency: Dimension
}

export type Overall = "healthy" | "degraded" | "misconfigured" | "unavailable"

export type TestRequest = {
  url: string
  method: RequestMethod
  auth?: AuthConfig
  headers: Record<string, string>
  body?: string
  assertions: Assertion[]
  latencyMs: number
}

export type TestResponse = {
  status: number
  statusText: string
  headers: Record<string, string>
  body: string
  contentType?: string
  durationMs: number
}

export type TestResult = {
  classification: Classification
  overall: Overall
  diagnosis: {
    title: string
    explanation: string
    next?: string
  }
  health: HealthDimensions
  response?: TestResponse
  suggestedAssertions: Assertion[]
  shapeChange?: string
  curl: string
}

export type HistoryEntry = {
  id: string
  at: number
  status?: number
  durationMs: number
  overall: Overall
}

export type FetchErrorKind =
  | "dns"
  | "timeout"
  | "abort"
  | "tls"
  | "network"
  | "ssrf"
  | "invalid_url"
  | "freeze"

export type TimedFetchResult = {
  ok: boolean
  status?: number
  statusText?: string
  headers: Record<string, string>
  bodyText: string
  contentType?: string
  bytes: number
  durationMs: number
  ttfbMs?: number
  error?: { kind: FetchErrorKind; message: string }
}

export type LogLevel = "info" | "ok" | "warn" | "error"

export type ProcessLog = {
  id: string
  at: number
  level: LogLevel
  message: string
  detail?: string
}
