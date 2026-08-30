import { describe, expect, it } from "vitest"

import {
  defaultPracticeConfig,
  serializePracticeCookie,
} from "@/lib/practice/config"
import { executeTest } from "@/lib/probe/execute"
import type { TestRequest } from "@/lib/probe/types"

const URL = "http://localhost:3000/api/practice/v2/translate"

function request(overrides: Partial<TestRequest> = {}): TestRequest {
  return {
    url: URL,
    method: "POST",
    auth: {
      kind: "api_key",
      headerName: "Ocp-Apim-Subscription-Key",
      queryName: "api_key",
      secret: defaultPracticeConfig().token,
    },
    headers: {},
    body: JSON.stringify({ in: "Hello", lang: "en-tw" }),
    assertions: [],
    latencyMs: 2000,
    ...overrides,
  }
}

describe("executeTest practice endpoint", () => {
  it("returns a healthy Ghana-shaped translation when every toggle is on", async () => {
    const result = await executeTest(request(), undefined, {
      cookie: serializePracticeCookie(defaultPracticeConfig()),
    })
    expect(result.overall).toBe("healthy")
    expect(result.health).toMatchObject({
      reachable: "pass",
      authenticated: "pass",
      requestValid: "pass",
      expectedOutput: "pass",
      latency: "pass",
    })
    expect(result.response?.body).toContain("translatedText")
  })

  it("fails reachability without calling the public route", async () => {
    const result = await executeTest(request(), undefined, {
      cookie: serializePracticeCookie({ ...defaultPracticeConfig(), reachable: false }),
    })
    expect(result.health.reachable).toBe("fail")
    expect(result.classification).toBe("network")
    expect(result.response).toBeUndefined()
  })

  it("fails expected output when the translation field is missing", async () => {
    const result = await executeTest(request(), undefined, {
      cookie: serializePracticeCookie({ ...defaultPracticeConfig(), expectedOutput: false }),
    })
    expect(result.health.expectedOutput).toBe("fail")
    expect(result.overall).toBe("degraded")
  })
})
