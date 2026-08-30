import type { TestResult } from "@/lib/probe/types"

const healthUnknown = {
  reachable: "unknown",
  authenticated: "unknown",
  requestValid: "unknown",
  expectedOutput: "unknown",
  latency: "unknown",
} as const

export const rejectedTokenResult: TestResult = {
  classification: "auth",
  overall: "misconfigured",
  diagnosis: {
    title: "Authentication failed",
    explanation: "The service rejected the credentials.",
    next: "Check the token and try again.",
  },
  health: {
    ...healthUnknown,
    reachable: "pass",
    authenticated: "fail",
  },
  suggestedAssertions: [],
  curl: "curl -X POST 'https://api.huniki.ai/translate'",
}

export const acceptedTokenResult: TestResult = {
  classification: "ok",
  overall: "healthy",
  diagnosis: {
    title: "Translation succeeded",
    explanation: "The provider returned a usable translation.",
    next: "Use this request as the known-good check.",
  },
  health: {
    reachable: "pass",
    authenticated: "pass",
    requestValid: "pass",
    expectedOutput: "pass",
    latency: "pass",
  },
  response: {
    status: 200,
    statusText: "OK",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ translatedText: "Agoo" }),
    contentType: "application/json",
    durationMs: 120,
  },
  suggestedAssertions: [{ path: "translatedText", kind: "nonempty" }],
  curl: "curl -X POST 'https://api.huniki.ai/translate'",
}

export function jsonResponse(body: unknown, status = 200): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  } as Response
}
