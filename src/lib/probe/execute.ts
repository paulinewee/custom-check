import { isPracticeEndpoint, parsePracticeCookie } from "@/lib/practice/config"
import { practiceTimedResult } from "@/lib/practice/handler"
import { RUN_TIMEOUT_MAX_MS } from "@/lib/probe/constants"
import { collectShape, describeShapeChange } from "@/lib/probe/assert"
import { toTestResult } from "@/lib/probe/classify"
import { timedFetch } from "@/lib/probe/http"
import { buildCurl } from "@/lib/probe/preview"
import type { Assertion, TestRequest, TestResult } from "@/lib/probe/types"

function applyAuth(request: TestRequest): { url: string; headers: Record<string, string> } {
  const url = new URL(request.url)
  const headers = { ...request.headers }

  if (request.auth?.secret) {
    if (request.auth.kind === "query") {
      url.searchParams.set(request.auth.queryName || "api_key", request.auth.secret)
    } else if (request.auth.kind === "bearer") {
      headers.Authorization = `Bearer ${request.auth.secret}`
    } else {
      headers[request.auth.headerName || "X-API-Key"] = request.auth.secret
    }
  }

  return { url: url.toString(), headers }
}

const PRACTICE_OUTPUT: Assertion[] = [{ path: "translatedText", kind: "nonempty" }]

export async function executeTest(
  request: TestRequest,
  previousShape?: string[],
  options?: { cookie?: string | null },
): Promise<TestResult> {
  const timeoutMs = Math.min(RUN_TIMEOUT_MAX_MS, Math.max(request.latencyMs + 8_000, 12_000))
  const { url, headers } = applyAuth(request)
  const curl = buildCurl(request, true)
  const practice = isPracticeEndpoint(url)
  const classified: TestRequest =
    practice && request.method === "POST" && request.assertions.length === 0
      ? { ...request, assertions: PRACTICE_OUTPUT }
      : request

  const fetchResult = practice
    ? await practiceTimedResult(
        url,
        {
          method: request.method,
          headers,
          body: request.method === "POST" && request.body?.trim() ? request.body : undefined,
        },
        parsePracticeCookie(options?.cookie),
      )
    : await timedFetch(
        url,
        {
          method: request.method,
          headers,
          body: request.method === "POST" && request.body?.trim() ? request.body : undefined,
        },
        timeoutMs,
      )

  const result = toTestResult(classified, fetchResult, { previousShape, curl })
  if (result.response && previousShape) {
    result.shapeChange = describeShapeChange(previousShape, collectShape(result.response.body))
  }
  return result
}
