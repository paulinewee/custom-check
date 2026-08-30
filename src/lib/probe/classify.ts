import { evaluateAssertion, suggestAssertions } from "@/lib/probe/assert"
import type {
  Classification,
  Dimension,
  HealthDimensions,
  Overall,
  TestRequest,
  TestResult,
  TimedFetchResult,
} from "@/lib/probe/types"

function classify(result: TimedFetchResult, slow: boolean): Classification {
  if (result.error) {
    if (result.error.kind === "dns") return "dns"
    if (result.error.kind === "timeout" || result.error.kind === "freeze") return "timeout"
    return "network"
  }

  const status = result.status ?? 0
  if (status === 401 || status === 403) return "auth"
  if (status === 404) return "not_found"
  if (status === 429) return "rate_limit"
  if (status === 400 || status === 415 || status === 422) return "bad_request"
  if (status >= 500) return "provider_error"
  if (status >= 200 && status < 300) return slow ? "slow" : "ok"
  return "unexpected"
}

function healthFor(
  classification: Classification,
  result: TimedFetchResult,
  request: TestRequest,
  outputOk: boolean,
  slow: boolean,
): HealthDimensions {
  const reachable: Dimension =
    classification === "dns" || classification === "network" || classification === "timeout"
      ? "fail"
      : result.status
        ? "pass"
        : "fail"

  let authenticated: Dimension = "unknown"
  if (classification === "auth") authenticated = "fail"
  else if (result.status && result.status !== 401 && result.status !== 403) {
    authenticated = request.auth?.secret || result.status < 500 ? "pass" : "unknown"
  }

  let requestValid: Dimension = "unknown"
  if (classification === "bad_request") requestValid = "fail"
  else if (classification === "auth" || classification === "not_found") requestValid = "unknown"
  else if (result.status && result.status >= 200 && result.status < 300) requestValid = "pass"

  const expectedOutput: Dimension =
    result.status && result.status >= 200 && result.status < 300
      ? outputOk
        ? "pass"
        : "fail"
      : "unknown"

  const latency: Dimension = !result.status
    ? "fail"
    : slow
      ? "warn"
      : "pass"

  return { reachable, authenticated, requestValid, expectedOutput, latency }
}

function overallFor(health: HealthDimensions, classification: Classification): Overall {
  if (
    health.reachable === "fail" ||
    classification === "provider_error" ||
    classification === "timeout" ||
    classification === "dns" ||
    classification === "network"
  ) {
    return "unavailable"
  }
  if (
    classification === "auth" ||
    classification === "bad_request" ||
    classification === "not_found"
  ) {
    return "misconfigured"
  }
  if (health.expectedOutput === "fail" || health.latency === "warn" || classification === "slow") {
    return "degraded"
  }
  return "healthy"
}

function diagnosisFor(
  classification: Classification,
  overall: Overall,
  durationMs: number,
  threshold: number,
): TestResult["diagnosis"] {
  switch (classification) {
    case "dns":
      return {
        title: "The hostname could not be resolved",
        explanation: "This is a DNS or network problem, not an application error on the provider.",
        next: "Confirm the host spelling, then retry.",
      }
    case "network":
      return {
        title: "The provider could not be reached",
        explanation: "The connection failed before an HTTP response arrived.",
        next: "Retry from another network, or confirm the host is not blocked.",
      }
    case "timeout":
      return {
        title: "The request timed out",
        explanation: "The provider accepted the connection but did not finish in time.",
        next: "Retry once. If it keeps hanging, the worker may be overloaded.",
      }
    case "auth":
      return {
        title: "The provider is reachable, but this request needs authentication.",
        explanation: "A 401 or 403 means the service is up. The credentials are missing, invalid, or not entitled to this product.",
        next: "Add authentication, then retest.",
      }
    case "not_found":
      return {
        title: "This path was not found",
        explanation: "The host responded, but this URL is not a recognized operation.",
        next: "Check the method and path, then retry.",
      }
    case "rate_limit":
      return {
        title: "The provider rate limited this request",
        explanation: "The service is up and asked you to slow down.",
        next: "Wait, then retry with the same request.",
      }
    case "bad_request":
      return {
        title: "Authentication works. The API needs additional request data.",
        explanation: "The provider accepted the caller, then rejected the body or content type.",
        next: "Add the required JSON fields, then retest.",
      }
    case "provider_error":
      return {
        title: "The provider failed to fulfill a valid-looking request",
        explanation: "The host is reachable, but this operation returned a server error.",
        next: "Retry. If it persists, the service is unavailable.",
      }
    case "unexpected":
      return {
        title: "The response was unexpected",
        explanation: "The provider responded, but not with a status this check treats as success.",
        next: "Inspect the raw response, then adjust the request.",
      }
    case "slow":
      return {
        title: "The request succeeded, but it was slow",
        explanation: `The response is structurally fine and took ${durationMs} ms, above the ${threshold} ms threshold.`,
        next: "Treat this as degraded until latency recovers.",
      }
    default:
      return overall === "healthy"
        ? {
            title: "The functional request succeeded",
            explanation: `The provider returned a usable response in ${durationMs} ms.`,
          }
        : {
            title: "The request completed with a warning",
            explanation: "The provider responded, but a health dimension did not pass.",
          }
  }
}

export function toTestResult(
  request: TestRequest,
  fetchResult: TimedFetchResult,
  options: { previousShape?: string[]; curl: string },
): TestResult {
  const threshold = request.latencyMs || 2000
  const slow = Boolean(fetchResult.status) && fetchResult.durationMs > threshold
  const classification = classify(fetchResult, slow)
  const outputOk =
    request.assertions.length === 0
      ? Boolean(fetchResult.status && fetchResult.status >= 200 && fetchResult.status < 300)
      : request.assertions.every((assertion) => evaluateAssertion(fetchResult.bodyText, assertion))

  const health = healthFor(classification, fetchResult, request, outputOk, slow)
  const overall = overallFor(health, classification)

  return {
    classification,
    overall,
    diagnosis: diagnosisFor(classification, overall, fetchResult.durationMs, threshold),
    health,
    response: fetchResult.status
      ? {
          status: fetchResult.status,
          statusText: fetchResult.statusText ?? "",
          headers: fetchResult.headers,
          body: fetchResult.bodyText,
          contentType: fetchResult.contentType,
          durationMs: fetchResult.durationMs,
        }
      : undefined,
    suggestedAssertions: fetchResult.status && fetchResult.status < 300
      ? suggestAssertions(fetchResult.bodyText)
      : [],
    curl: options.curl,
  }
}
