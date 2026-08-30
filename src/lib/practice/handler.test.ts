import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import { defaultPracticeConfig, PRACTICE_SLOW_MS } from "./config"
import { handlePracticeRequest, translatePractice } from "./handler"

const TRANSLATE = "http://localhost:3000/api/practice/translate"
const LEGACY = "http://localhost:3000/api/practice/v2/translate"

function hunikiBody(overrides: Record<string, unknown> = {}) {
  return {
    text: "Hello",
    source: "en",
    target: "tw",
    api_name: "ghananlp",
    api_key: defaultPracticeConfig().token,
    ...overrides,
  }
}

function request(url: string, init: { method?: string; body?: unknown } = {}) {
  return new Request(url, {
    method: init.method ?? "POST",
    headers: { "Content-Type": "application/json" },
    body: init.body === undefined ? undefined : JSON.stringify(init.body),
  })
}

async function read(response: Response) {
  return { status: response.status, body: await response.json() }
}

describe("handlePracticeRequest", () => {
  const working = defaultPracticeConfig()

  it("translates a Huniki-shaped POST", async () => {
    const response = await handlePracticeRequest(request(TRANSLATE, { body: hunikiBody() }), working)
    expect(await read(response)).toEqual({
      status: 200,
      body: { translatedText: "Agoo" },
    })
  })

  it("accepts the legacy practice translate path", async () => {
    const response = await handlePracticeRequest(request(LEGACY, { body: hunikiBody() }), working)
    expect((await read(response)).status).toBe(200)
  })

  it("rejects a missing or wrong api_key", async () => {
    expect(
      (await handlePracticeRequest(request(TRANSLATE, { body: hunikiBody({ api_key: "" }) }), working))
        .status,
    ).toBe(401)
    expect(
      (
        await handlePracticeRequest(
          request(TRANSLATE, { body: hunikiBody({ api_key: "wrong" }) }),
          working,
        )
      ).status,
    ).toBe(401)
  })

  it("rejects every key when authentication is off", async () => {
    const response = await handlePracticeRequest(request(TRANSLATE, { body: hunikiBody() }), {
      ...working,
      authenticated: false,
    })
    expect(response.status).toBe(401)
  })

  it("rejects a valid body when request shape is off", async () => {
    const response = await handlePracticeRequest(request(TRANSLATE, { body: hunikiBody() }), {
      ...working,
      requestValid: false,
    })
    expect(response.status).toBe(400)
  })

  it("accepts every Huniki provider and an unknown api_name", async () => {
    for (const api_name of ["ghananlp", "lelapa", "lesan", "unknown"]) {
      const response = await handlePracticeRequest(
        request(TRANSLATE, { body: hunikiBody({ api_name }) }),
        working,
      )
      expect(response.status, api_name).toBe(200)
    }
  })

  it("accepts practice-key even when a custom token is configured", async () => {
    const response = await handlePracticeRequest(request(TRANSLATE, { body: hunikiBody() }), {
      ...working,
      token: "custom-token",
    })
    expect(response.status).toBe(200)
  })

  it("accepts the token under a different JSON key", async () => {
    const response = await handlePracticeRequest(
      request(TRANSLATE, {
        body: { ...hunikiBody(), api_key: undefined, token: working.token },
      }),
      working,
    )
    expect(response.status).toBe(200)
  })

  it("omits translatedText when expected output is off", async () => {
    const response = await handlePracticeRequest(request(TRANSLATE, { body: hunikiBody() }), {
      ...working,
      expectedOutput: false,
    })
    expect(await read(response)).toEqual({
      status: 200,
      body: { message: "ok", echo: "Hello" },
    })
  })

  it("returns 503 when the public route is marked unreachable", async () => {
    const response = await handlePracticeRequest(request(TRANSLATE, { body: hunikiBody() }), {
      ...working,
      reachable: false,
    })
    expect(response.status).toBe(503)
  })
})

describe("slow practice responses", () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it("waits past the latency threshold when response time is off", async () => {
    const pending = handlePracticeRequest(request(TRANSLATE, { body: hunikiBody() }), {
      ...defaultPracticeConfig(),
      latency: false,
    })
    await vi.advanceTimersByTimeAsync(PRACTICE_SLOW_MS)
    expect((await pending).status).toBe(200)
  })
})

describe("translatePractice", () => {
  it("uses a canned Twi greeting and otherwise tags the target", () => {
    expect(translatePractice("Hello", "en", "tw")).toBe("Agoo")
    expect(translatePractice("Good morning", "en", "ee")).toBe("Good morning [ee]")
  })
})
