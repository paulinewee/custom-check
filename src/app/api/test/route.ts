import { executeTest } from "@/lib/probe/execute"
import { assertPublicTarget, parsePublicHttpUrl, UrlValidationError } from "@/lib/probe/url"
import type { Assertion, AuthConfig, RequestMethod, TestRequest } from "@/lib/probe/types"

export const runtime = "nodejs"
export const maxDuration = 30

function asRequest(body: Record<string, unknown>): TestRequest {
  const method: RequestMethod = body.method === "GET" ? "GET" : "POST"
  const auth = body.auth as Partial<AuthConfig> | undefined
  const assertions = Array.isArray(body.assertions)
    ? (body.assertions as Assertion[]).filter((item) => item && typeof item.path === "string")
    : []

  const headers: Record<string, string> = {}
  if (body.headers && typeof body.headers === "object") {
    for (const [key, value] of Object.entries(body.headers as Record<string, unknown>)) {
      if (key.trim() && typeof value === "string" && value) headers[key] = value
    }
  }

  return {
    url: typeof body.url === "string" ? body.url : "",
    method,
    auth:
      auth && typeof auth.secret === "string" && auth.secret
        ? {
            kind: auth.kind === "bearer" || auth.kind === "query" ? auth.kind : "api_key",
            headerName: auth.headerName || "X-API-Key",
            queryName: auth.queryName || "api_key",
            secret: auth.secret,
          }
        : undefined,
    headers,
    body: typeof body.body === "string" ? body.body : undefined,
    assertions,
    latencyMs: Number(body.latencyMs) || 2000,
  }
}

export async function POST(request: Request) {
  try {
    const raw = (await request.json()) as Record<string, unknown>
    const testRequest = asRequest(raw)
    const url = parsePublicHttpUrl(testRequest.url)
    await assertPublicTarget(url)

    const previousShape = Array.isArray(raw.previousShape)
      ? raw.previousShape.filter((item): item is string => typeof item === "string")
      : undefined

    return Response.json(
      await executeTest({ ...testRequest, url: url.toString() }, previousShape, {
        cookie: request.headers.get("cookie"),
      }),
    )
  } catch (error) {
    if (error instanceof UrlValidationError) {
      return Response.json({ error: error.message }, { status: 400 })
    }
    return Response.json(
      { error: error instanceof Error ? error.message : "Test failed" },
      { status: 502 },
    )
  }
}
