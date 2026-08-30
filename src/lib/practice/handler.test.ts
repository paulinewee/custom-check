import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import { defaultPracticeConfig, PRACTICE_SLOW_MS } from "./config"
import { handlePracticeRequest, PRACTICE_LANGUAGES, translatePractice } from "./handler"

const TRANSLATE = "http://localhost:3000/api/practice/v2/translate"
const LANGUAGES = "http://localhost:3000/api/practice/v2/languages"

function request(
  url: string,
  init: { method?: string; token?: string; body?: unknown } = {},
) {
  const headers = new Headers()
  if (init.token) headers.set("Ocp-Apim-Subscription-Key", init.token)
  return new Request(url, {
    method: init.method ?? "POST",
    headers,
    body: init.body === undefined ? undefined : JSON.stringify(init.body),
  })
}

async function read(response: Response) {
  return { status: response.status, body: await response.json() }
}

describe("handlePracticeRequest", () => {
  const working = defaultPracticeConfig()

  it("translates a GhanaNLP-shaped POST", async () => {
    const response = await handlePracticeRequest(
      request(TRANSLATE, {
        token: working.token,
        body: { in: "Hello", lang: "en-tw" },
      }),
      working,
    )
    expect(await read(response)).toEqual({
      status: 200,
      body: { translatedText: "Agoo" },
    })
  })

  it("lists languages", async () => {
    const response = await handlePracticeRequest(
      request(LANGUAGES, { method: "GET", token: working.token }),
      working,
    )
    expect(await read(response)).toEqual({ status: 200, body: PRACTICE_LANGUAGES })
  })

  it("rejects a missing or wrong token", async () => {
    expect((await handlePracticeRequest(request(TRANSLATE, { body: {} }), working)).status).toBe(
      401,
    )
    expect(
      (
        await handlePracticeRequest(
          request(TRANSLATE, { token: "wrong", body: { in: "Hello", lang: "en-tw" } }),
          working,
        )
      ).status,
    ).toBe(401)
  })

  it("rejects every token when authentication is off", async () => {
    const response = await handlePracticeRequest(
      request(TRANSLATE, { token: working.token, body: { in: "Hello", lang: "en-tw" } }),
      { ...working, authenticated: false },
    )
    expect(response.status).toBe(401)
  })

  it("fails the languages list when that toggle is off", async () => {
    const response = await handlePracticeRequest(
      request(LANGUAGES, { method: "GET", token: working.token }),
      { ...working, languages: false },
    )
    expect(response.status).toBe(503)
  })

  it("rejects a valid body when request shape is off", async () => {
    const response = await handlePracticeRequest(
      request(TRANSLATE, { token: working.token, body: { in: "Hello", lang: "en-tw" } }),
      { ...working, requestValid: false },
    )
    expect(response.status).toBe(400)
  })

  it("omits translatedText when expected output is off", async () => {
    const response = await handlePracticeRequest(
      request(TRANSLATE, { token: working.token, body: { in: "Hello", lang: "en-tw" } }),
      { ...working, expectedOutput: false },
    )
    expect(await read(response)).toEqual({
      status: 200,
      body: { message: "ok", echo: "Hello" },
    })
  })

  it("returns 503 when the public route is marked unreachable", async () => {
    const response = await handlePracticeRequest(
      request(TRANSLATE, { token: working.token, body: { in: "Hello", lang: "en-tw" } }),
      { ...working, reachable: false },
    )
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
    const pending = handlePracticeRequest(
      request(TRANSLATE, {
        token: defaultPracticeConfig().token,
        body: { in: "Hello", lang: "en-tw" },
      }),
      { ...defaultPracticeConfig(), latency: false },
    )
    await vi.advanceTimersByTimeAsync(PRACTICE_SLOW_MS)
    expect((await pending).status).toBe(200)
  })
})

describe("translatePractice", () => {
  it("uses a canned Twi greeting and otherwise tags the target", () => {
    expect(translatePractice("Hello", "en-tw")).toBe("Agoo")
    expect(translatePractice("Good morning", "en-ee")).toBe("Good morning [ee]")
  })
})
