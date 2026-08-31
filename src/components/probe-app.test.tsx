import { render, screen, waitFor, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import { SavedTestsProvider } from "@/components/saved-tests-context"
import { TRANSLATE_ENDPOINT } from "@/lib/probe/constants"
import { HUNIKI_LANGUAGES } from "@/lib/probe/defaults"
import { readSavedTests } from "@/lib/saved-tests"
import { acceptedTokenResult, jsonResponse, rejectedTokenResult } from "@/test/fixtures"

import { ProbeApp } from "./probe-app"

function mockFetch(impl: (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>) {
  vi.stubGlobal("fetch", vi.fn(impl))
  return fetch as unknown as ReturnType<typeof vi.fn>
}

function requestPayload(call: unknown[] | undefined) {
  return JSON.parse(String((call?.[1] as RequestInit | undefined)?.body ?? "{}")) as {
    url?: string
    method?: string
    body?: string
    auth?: { secret?: string; headerName?: string; kind?: string }
  }
}

function payloads(fetchMock: ReturnType<typeof mockFetch>) {
  return fetchMock.mock.calls.map((call) => requestPayload(call))
}

function mockHunikiApi() {
  return mockFetch(async () => jsonResponse(acceptedTokenResult))
}

async function typeEndpoint(user: ReturnType<typeof userEvent.setup>, url: string) {
  const input = screen.getByRole("textbox", { name: "Endpoint" })
  await user.clear(input)
  await user.type(input, url)
}

async function waitForAuthCard() {
  return screen.findByRole("heading", {
    name: /Your endpoint requires a provider and an authentication token/,
  })
}

async function expandAuth(user: ReturnType<typeof userEvent.setup>) {
  const expand = screen.queryByRole("button", { name: "Expand authentication" })
  if (expand) await user.click(expand)
}

async function enterAcceptedToken(user: ReturnType<typeof userEvent.setup>) {
  mockHunikiApi()
  await user.type(screen.getByLabelText("Authentication token"), "tok_live")
  await screen.findByRole("heading", { name: /Customize your test/ })
}

async function submitCheck(user: ReturnType<typeof userEvent.setup>) {
  await user.click(screen.getByRole("button", { name: "Submit" }))
}

function languageValue(name: "Source Language" | "Target Language") {
  const field = name === "Source Language" ? "source" : "target"
  const input = document.querySelector(`input[name="${field}"]`) as HTMLInputElement | null
  if (input) return input.value
  const fallback = screen.queryByLabelText(name)
  return fallback instanceof HTMLInputElement || fallback instanceof HTMLTextAreaElement
    ? fallback.value
    : fallback?.textContent
}

async function chooseLanguage(
  user: ReturnType<typeof userEvent.setup>,
  name: "Source Language" | "Target Language",
  option: string,
) {
  await user.click(screen.getByRole("combobox", { name }))
  await user.click(await screen.findByRole("option", { name: option }))
}

describe("ProbeApp", () => {
  beforeEach(() => {
    vi.stubGlobal(
      "fetch",
      vi.fn(() => {
        throw new Error("fetch was called without a mock")
      }),
    )
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    vi.useRealTimers()
    window.localStorage.clear()
  })

  describe("starting state", () => {
    it("starts with the title and URL field only", () => {
      render(<ProbeApp initialUrl="" />)

      expect(
        screen.getByRole("heading", { level: 1, name: "Put your translation API to the test." }),
      ).toBeInTheDocument()
      expect(
        screen.getByText(
          "Quickly check capabilities, performance, and failures before integration.",
        ),
      ).toBeInTheDocument()

      const endpoint = screen.getByRole("textbox", { name: "Endpoint" })
      expect(endpoint).toHaveAttribute("placeholder", "http://")
      expect(endpoint).toHaveValue("")
      expect(endpoint).toHaveFocus()
      expect(endpoint).not.toHaveClass("font-mono")

      expect(
        screen.queryByRole("heading", {
          name: /Your endpoint requires a provider and an authentication token/,
        }),
      ).not.toBeInTheDocument()
      expect(screen.queryByRole("heading", { name: /Customize your test/ })).not.toBeInTheDocument()
      expect(screen.queryByLabelText("Authentication token")).not.toBeInTheDocument()
      expect(screen.queryByLabelText("Input")).not.toBeInTheDocument()
    })

    it("validates an empty URL on blur", async () => {
      const user = userEvent.setup()
      render(<ProbeApp initialUrl="" />)

      await user.click(screen.getByRole("textbox", { name: "Endpoint" }))
      await user.tab()

      expect(screen.getByRole("alert")).toHaveTextContent("Enter an http(s) endpoint.")
    })

    it("shows a URL error and keeps the auth card hidden", async () => {
      const user = userEvent.setup()
      render(<ProbeApp initialUrl="" />)

      await typeEndpoint(user, "hello world")

      expect(screen.getByRole("alert")).toHaveTextContent("That is not a valid URL.")
      expect(screen.queryByLabelText("Authentication token")).not.toBeInTheDocument()
    })

    it("adds https when a host is typed without a scheme", async () => {
      const user = userEvent.setup()
      render(<ProbeApp initialUrl="" />)

      await typeEndpoint(user, "api.huniki.ai/translate")
      await waitForAuthCard()

      expect(screen.queryByRole("alert")).not.toBeInTheDocument()
      await user.tab()
      expect(screen.getByRole("textbox", { name: "Endpoint" })).toHaveValue(
        "https://api.huniki.ai/translate",
      )
    })

    it("rejects private hosts", async () => {
      const user = userEvent.setup()
      render(<ProbeApp initialUrl="" />)

      await typeEndpoint(user, "http://localhost/v2/translate")

      expect(screen.getByRole("alert")).toHaveTextContent(
        "Private or local hosts cannot be tested.",
      )
      expect(screen.queryByLabelText("Authentication token")).not.toBeInTheDocument()
    })

    it("allows the local practice endpoint", async () => {
      const user = userEvent.setup()
      mockHunikiApi()
      render(<ProbeApp initialUrl="" />)

      await typeEndpoint(user, "http://localhost:3000/api/practice/translate")
      await waitForAuthCard()

      expect(screen.getByLabelText("Authentication token")).toBeInTheDocument()
    })
  })

  describe("Huniki endpoint", () => {
    it("reveals the auth card after a valid Huniki translate URL", async () => {
      const user = userEvent.setup()
      render(<ProbeApp initialUrl="" />)

      await typeEndpoint(user, TRANSLATE_ENDPOINT)
      await waitForAuthCard()

      expect(screen.getByRole("combobox", { name: "Provider" })).toHaveTextContent("GhanaNLP")
      await user.click(screen.getByRole("combobox", { name: "Provider" }))
      expect(screen.getByRole("option", { name: "GhanaNLP" })).toBeInTheDocument()
      expect(screen.getByRole("option", { name: "Lelapa" })).toBeInTheDocument()
      expect(screen.getByRole("option", { name: "Lesan" })).toBeInTheDocument()
      expect(screen.queryByRole("option", { name: "Google" })).not.toBeInTheDocument()
      expect(screen.queryByRole("option", { name: "Microsoft" })).not.toBeInTheDocument()
      expect(screen.getByLabelText("Authentication token")).toHaveAttribute(
        "placeholder",
        "eyJhbGci…",
      )
      expect(screen.queryByRole("heading", { name: /Customize your test/ })).not.toBeInTheDocument()
    })

    it("opens the Huniki translate URL when it is already valid", async () => {
      render(<ProbeApp initialUrl={TRANSLATE_ENDPOINT} />)

      await waitForAuthCard()
      expect(screen.getByRole("textbox", { name: "Endpoint" })).toHaveValue(TRANSLATE_ENDPOINT)
    })
  })

  describe("authentication", () => {
    it("validates an empty token on blur", async () => {
      const user = userEvent.setup()
      render(<ProbeApp initialUrl={TRANSLATE_ENDPOINT} />)
      await waitForAuthCard()

      await user.click(screen.getByLabelText("Authentication token"))
      await user.tab()

      expect(screen.getByRole("alert")).toHaveTextContent("Enter an API key.")
      expect(fetch).not.toHaveBeenCalled()
    })

    it("checks the token after debounce and reports a rejection", async () => {
      const user = userEvent.setup()
      const fetchMock = mockFetch(async () => jsonResponse(rejectedTokenResult))

      render(<ProbeApp initialUrl={TRANSLATE_ENDPOINT} />)
      await waitForAuthCard()
      await user.type(screen.getByLabelText("Authentication token"), "bad-token")

      await waitFor(() => expect(fetchMock).toHaveBeenCalled())
      expect(fetchMock).toHaveBeenCalledWith(
        "/api/test",
        expect.objectContaining({
          method: "POST",
          headers: { "content-type": "application/json" },
        }),
      )

      const body = requestPayload(fetchMock.mock.calls.at(-1))
      expect(body.url).toBe(TRANSLATE_ENDPOINT)
      expect(body.method).toBe("POST")
      expect(body.auth?.secret).toBe("bad-token")
      expect(body.auth?.kind).toBe("body")
      expect(body.auth?.headerName).toBe("api_key")
      expect(JSON.parse(body.body ?? "{}")).toMatchObject({
        text: "The quick brown fox jumps over the lazy dog.",
        source: "en",
        target: "tw",
        api_name: "ghananlp",
        api_key: "bad-token",
      })
      expect(payloads(fetchMock).some((item) => item.method === "GET")).toBe(false)

      expect(
        await screen.findByText("That token was rejected. Check the value and try again."),
      ).toBeInTheDocument()
      expect(screen.getByLabelText("Authentication token")).toBeInTheDocument()
      expect(screen.queryByRole("heading", { name: /Customize your test/ })).not.toBeInTheDocument()
    })

    it("collapses auth after an accepted token and does not show results yet", async () => {
      const user = userEvent.setup()
      render(<ProbeApp initialUrl={TRANSLATE_ENDPOINT} />)
      await waitForAuthCard()
      await enterAcceptedToken(user)

      expect(screen.getByText("Provider and Authentication Token")).toBeInTheDocument()
      expect(
        screen.queryByRole("heading", {
          name: /Your endpoint requires a provider and an authentication token/,
        }),
      ).not.toBeInTheDocument()
      expect(screen.getByRole("button", { name: "Submit" })).toBeInTheDocument()
      expect(screen.queryByRole("button", { name: "Next" })).not.toBeInTheDocument()
      expect(
        screen.queryByRole("heading", { name: "Set thresholds and limits" }),
      ).not.toBeInTheDocument()
      expect(
        screen.queryByRole("heading", { name: /Your request succeeded/ }),
      ).not.toBeInTheDocument()
      expect(screen.queryByRole("heading", { name: /This session/ })).not.toBeInTheDocument()
    })
  })

  describe("customize check", () => {
    it("shows Huniki translate fields and send parameters", async () => {
      const user = userEvent.setup()
      render(<ProbeApp initialUrl={TRANSLATE_ENDPOINT} />)
      await waitForAuthCard()
      await enterAcceptedToken(user)

      expect(screen.getByText("Customize your test")).toBeInTheDocument()
      expect(screen.queryByRole("radio", { name: "GET" })).not.toBeInTheDocument()
      expect(screen.queryByRole("radio", { name: "POST" })).not.toBeInTheDocument()
      expect(screen.getByLabelText("Input")).toHaveValue(
        "The quick brown fox jumps over the lazy dog.",
      )
      expect(screen.getByText("9 words, 44 characters")).toBeInTheDocument()
      expect(screen.queryByLabelText("Generate test words")).not.toBeInTheDocument()
      expect(languageValue("Source Language")).toBe("en")
      expect(languageValue("Target Language")).toBe("tw")
      expect(screen.queryByRole("combobox", { name: "Provider" })).not.toBeInTheDocument()
      expect(screen.queryByLabelText("in")).not.toBeInTheDocument()
      expect(screen.queryByLabelText("Format")).not.toBeInTheDocument()
      expect(screen.getByLabelText("Requests")).toHaveValue(1)
      expect(screen.queryByLabelText("Maximum delay")).not.toBeInTheDocument()
      expect(screen.getByRole("checkbox", { name: "Test all language pairs" })).not.toBeChecked()
      expect(screen.queryByRole("radio", { name: "Sequential" })).not.toBeInTheDocument()
      expect(screen.queryByText("Sequence")).not.toBeInTheDocument()
      expect(screen.queryByLabelText("Delay between requests (ms)")).not.toBeInTheDocument()
      expect(screen.getByRole("button", { name: "Submit" })).toBeInTheDocument()
      expect(screen.getByRole("button", { name: "Preview requests" })).toBeInTheDocument()
      expect(screen.queryByRole("tab")).not.toBeInTheDocument()
      expect(screen.queryByRole("button", { name: "Edit fields" })).not.toBeInTheDocument()
      expect(screen.queryByRole("button", { name: "Edit JSON" })).not.toBeInTheDocument()
      expect(screen.queryByText("What we will send")).not.toBeInTheDocument()

      await user.click(screen.getByRole("button", { name: "Preview requests" }))
      expect(screen.getByRole("button", { name: "Edit fields" })).toBeInTheDocument()
      expect(screen.queryByRole("button", { name: "Preview requests" })).not.toBeInTheDocument()
      const row = document.querySelector("summary")
      expect(row?.textContent).toBe(`curl -X POST '${TRANSLATE_ENDPOINT}'`)
      const preview = document.querySelector("pre")
      expect(preview?.textContent).toMatch(/-H 'Content-Type/)
      expect(preview?.textContent).toMatch(
        /"text": "The quick brown fox jumps over the lazy dog."/,
      )
      expect(preview?.textContent).toMatch(/"source": "en"/)
      expect(preview?.textContent).toMatch(/"target": "tw"/)
      expect(preview?.textContent).toMatch(/"api_name": "ghananlp"/)
      expect(preview?.textContent).toMatch(/"api_key"/)

      await user.click(screen.getByRole("button", { name: "Edit fields" }))
      expect(screen.getByRole("button", { name: "Preview requests" })).toBeInTheDocument()
      expect(screen.getByLabelText("Input")).toBeVisible()
    })

    it("uses the same Huniki fields for any host", async () => {
      const user = userEvent.setup()
      render(<ProbeApp initialUrl="https://example.com/translate" />)
      await waitForAuthCard()
      await enterAcceptedToken(user)

      expect(screen.getByLabelText("Input")).toHaveValue(
        "The quick brown fox jumps over the lazy dog.",
      )
      expect(languageValue("Source Language")).toBe("en")
      expect(languageValue("Target Language")).toBe("tw")
      expect(screen.queryByRole("combobox", { name: "Provider" })).not.toBeInTheDocument()
      expect(screen.queryByLabelText("input_text")).not.toBeInTheDocument()
    })

    it("fills Source Language and Target Language from Huniki codes", async () => {
      const user = userEvent.setup()
      render(<ProbeApp initialUrl={TRANSLATE_ENDPOINT} />)
      await waitForAuthCard()
      await enterAcceptedToken(user)

      expect(languageValue("Source Language")).toBe("en")
      expect(languageValue("Target Language")).toBe("tw")
      await user.click(screen.getByRole("combobox", { name: "Source Language" }))
      expect(screen.getByRole("option", { name: "Twi" })).toBeInTheDocument()
      expect(screen.getByRole("option", { name: "Ga" })).toBeInTheDocument()
      expect(screen.getByRole("option", { name: "Fante" })).toBeInTheDocument()
      expect(screen.queryByRole("option", { name: /English → Twi/ })).not.toBeInTheDocument()
      await user.keyboard("{Escape}")
    })

    it("uses a textarea for Input and language names in the dropdowns", async () => {
      const user = userEvent.setup()
      render(<ProbeApp initialUrl={TRANSLATE_ENDPOINT} />)
      await waitForAuthCard()
      await enterAcceptedToken(user)

      expect(screen.getByLabelText("Input").tagName).toBe("TEXTAREA")
      expect(screen.getByText("9 words, 44 characters")).toBeInTheDocument()
      expect(languageValue("Source Language")).toBe("en")
      expect(languageValue("Target Language")).toBe("tw")
      expect(screen.getByRole("combobox", { name: "Source Language" })).toHaveTextContent("English")
      expect(screen.getByRole("combobox", { name: "Target Language" })).toHaveTextContent("Twi")
      expect(screen.queryByRole("button", { name: "About Input" })).not.toBeInTheDocument()
      expect(screen.queryByRole("button", { name: "About Source Language" })).not.toBeInTheDocument()
      expect(screen.queryByRole("button", { name: "About this check" })).not.toBeInTheDocument()
      expect(screen.queryByRole("button", { name: "About authentication tokens" })).not.toBeInTheDocument()
      expect(screen.queryByRole("button", { name: "About the format" })).not.toBeInTheDocument()
      expect(screen.queryByRole("button", { name: "About the maximum delay" })).not.toBeInTheDocument()
      expect(screen.queryByRole("button", { name: "About generated test words" })).not.toBeInTheDocument()
    })

    it("updates the Input word and character count as you type", async () => {
      const user = userEvent.setup()
      render(<ProbeApp initialUrl={TRANSLATE_ENDPOINT} />)
      await waitForAuthCard()
      await enterAcceptedToken(user)

      expect(screen.getByText("9 words, 44 characters")).toBeInTheDocument()
      await user.clear(screen.getByLabelText("Input"))
      await user.type(screen.getByLabelText("Input"), "Hello there")
      expect(screen.getByText("2 words, 11 characters")).toBeInTheDocument()
    })

    it("shows one expandable curl block per request on Preview requests", async () => {
      const user = userEvent.setup()
      render(<ProbeApp initialUrl={TRANSLATE_ENDPOINT} />)
      await waitForAuthCard()
      await enterAcceptedToken(user)

      await user.clear(screen.getByLabelText("Requests"))
      await user.type(screen.getByLabelText("Requests"), "3")
      await user.click(screen.getByRole("button", { name: "Preview requests" }))

      expect(screen.queryByText("Request 1")).not.toBeInTheDocument()
      const rows = document.querySelectorAll("summary")
      expect(rows).toHaveLength(3)
      expect(rows[0]?.textContent).toBe(`curl -X POST '${TRANSLATE_ENDPOINT}'`)
      expect(rows[1]?.textContent).toBe(`curl -X POST '${TRANSLATE_ENDPOINT}'`)
      expect(rows[2]?.textContent).toBe(`curl -X POST '${TRANSLATE_ENDPOINT}'`)
      const previews = document.querySelectorAll("pre")
      expect(previews).toHaveLength(3)
      expect(previews[0]?.textContent).toMatch(/-H 'Content-Type/)
      expect(previews[0]?.textContent).toMatch(
        /"text": "The quick brown fox jumps over the lazy dog."/,
      )
    })

    it("reveals sequence options after more than one request", async () => {
      const user = userEvent.setup()
      render(<ProbeApp initialUrl={TRANSLATE_ENDPOINT} />)
      await waitForAuthCard()
      await enterAcceptedToken(user)

      expect(screen.queryByText("Sequence")).not.toBeInTheDocument()
      await user.clear(screen.getByLabelText("Requests"))
      await user.type(screen.getByLabelText("Requests"), "2")
      expect(screen.getByRole("radio", { name: "Sequential" })).toBeChecked()
      expect(screen.getByRole("radio", { name: "Concurrent" })).toBeInTheDocument()
      expect(screen.queryByRole("radio", { name: "With a delay" })).not.toBeInTheDocument()
      expect(screen.queryByLabelText("Delay between requests (ms)")).not.toBeInTheDocument()
    })

    it("locks Requests to every language pair when Test all language pairs is on", async () => {
      const user = userEvent.setup()
      render(<ProbeApp initialUrl={TRANSLATE_ENDPOINT} />)
      await waitForAuthCard()
      await enterAcceptedToken(user)

      await user.clear(screen.getByLabelText("Requests"))
      await user.type(screen.getByLabelText("Requests"), "3")
      await user.click(screen.getByRole("checkbox", { name: "Test all language pairs" }))

      const pairCount = HUNIKI_LANGUAGES.length * HUNIKI_LANGUAGES.length
      const count = screen.getByLabelText("Requests")
      expect(count).toHaveValue(pairCount)
      expect(count).toBeDisabled()
      expect(screen.getByRole("radio", { name: "Sequential" })).toBeChecked()
      expect(screen.getByRole("radio", { name: "Concurrent" })).toBeEnabled()

      await user.click(screen.getByRole("checkbox", { name: "Test all language pairs" }))
      expect(screen.getByLabelText("Requests")).toBeEnabled()
      expect(screen.getByLabelText("Requests")).toHaveValue(3)
    })

    it("sends a distinct source and target for every language pair", async () => {
      const user = userEvent.setup()
      render(<ProbeApp initialUrl={TRANSLATE_ENDPOINT} />)
      await waitForAuthCard()
      await enterAcceptedToken(user)

      await user.click(screen.getByRole("checkbox", { name: "Test all language pairs" }))
      const fetchMock = mockFetch(async () => jsonResponse(acceptedTokenResult))
      await submitCheck(user)

      const pairCount = HUNIKI_LANGUAGES.length * HUNIKI_LANGUAGES.length
      await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(pairCount))
      const bodies = payloads(fetchMock).map((item) => JSON.parse(String(item.body ?? "{}")))
      expect(bodies[0]).toMatchObject({ source: "en", target: "en" })
      expect(bodies[1]).toMatchObject({ source: "en", target: "tw" })
      expect(bodies.at(-1)).toMatchObject({
        source: HUNIKI_LANGUAGES.at(-1)?.code,
        target: HUNIKI_LANGUAGES.at(-1)?.code,
      })
    })
  })

  describe("URL changes", () => {
    it("rechecks the token and keeps the Huniki body", async () => {
      const user = userEvent.setup()
      render(<ProbeApp initialUrl={TRANSLATE_ENDPOINT} />)
      await waitForAuthCard()
      await enterAcceptedToken(user)

      expect(screen.getByRole("heading", { name: /Customize your test/ })).toBeInTheDocument()

      const fetchMock = mockHunikiApi()
      await typeEndpoint(user, "https://example.com/translate")

      expect(screen.queryByRole("heading", { name: /Customize your test/ })).not.toBeInTheDocument()
      expect(
        await screen.findByRole("heading", {
          name: /Your endpoint requires a provider and an authentication token/,
        }),
      ).toBeInTheDocument()

      await waitFor(() => {
        expect(
          payloads(fetchMock).some(
            (body) =>
              body.url === "https://example.com/translate" && body.auth?.secret === "tok_live",
          ),
        ).toBe(true)
      })

      expect(await screen.findByRole("heading", { name: /Customize your test/ })).toBeInTheDocument()
      expect(payloads(fetchMock).some((body) => body.method === "GET")).toBe(false)
      expect(screen.getByLabelText("Input")).toHaveValue(
        "The quick brown fox jumps over the lazy dog.",
      )
      expect(languageValue("Source Language")).toBe("en")
      expect(languageValue("Target Language")).toBe("tw")
      expect(
        screen.queryByRole("heading", { name: /Your request succeeded/ }),
      ).not.toBeInTheDocument()
    })
  })

  describe("validation", () => {
    it("blocks Submit when the phrase is empty", async () => {
      const user = userEvent.setup()
      render(<ProbeApp initialUrl={TRANSLATE_ENDPOINT} />)
      await waitForAuthCard()
      await enterAcceptedToken(user)

      await user.clear(screen.getByLabelText("Input"))

      const fetchMock = mockFetch(async () => jsonResponse(acceptedTokenResult))
      await user.click(screen.getByRole("button", { name: "Submit" }))

      expect(screen.getByText(/Enter the text to send/)).toBeInTheDocument()
      expect(
        screen.queryByRole("heading", { name: "Set thresholds and limits" }),
      ).not.toBeInTheDocument()
      expect(fetchMock).not.toHaveBeenCalled()
    })
  })

  describe("submit", () => {
    it("shows Running... on Submit instead of a status line", async () => {
      const user = userEvent.setup()
      render(<ProbeApp initialUrl={TRANSLATE_ENDPOINT} />)
      await waitForAuthCard()
      await enterAcceptedToken(user)

      let release!: (response: Response) => void
      const pending = new Promise<Response>((resolve) => {
        release = resolve
      })
      mockFetch(() => pending)
      await submitCheck(user)

      expect(screen.getByRole("button", { name: "Running..." })).toBeDisabled()
      expect(screen.queryByText("Running the check…")).not.toBeInTheDocument()
      expect(screen.queryByText(/Running \d+ checks/)).not.toBeInTheDocument()

      release(jsonResponse(acceptedTokenResult))
      expect(await screen.findByRole("button", { name: "Retest" })).toBeEnabled()
    })

    it("sends the Huniki translate body with the chosen languages and provider", async () => {
      const user = userEvent.setup()
      render(<ProbeApp initialUrl={TRANSLATE_ENDPOINT} />)
      await waitForAuthCard()
      await enterAcceptedToken(user)

      await user.clear(screen.getByLabelText("Input"))
      await user.type(screen.getByLabelText("Input"), "Good morning")
      await chooseLanguage(user, "Source Language", "Twi")
      await chooseLanguage(user, "Target Language", "English")
      await expandAuth(user)
      await user.click(screen.getByRole("combobox", { name: "Provider" }))
      await user.click(await screen.findByRole("option", { name: "Lelapa" }))

      const fetchMock = mockFetch(async () => jsonResponse(acceptedTokenResult))
      await submitCheck(user)
      await waitFor(() => expect(fetchMock).toHaveBeenCalled())

      const payload = requestPayload(fetchMock.mock.calls[0])
      expect(payload.url).toBe(TRANSLATE_ENDPOINT)
      expect(payload.method).toBe("POST")
      expect(payload.auth?.secret).toBe("tok_live")
      expect(payload.auth?.kind).toBe("body")
      expect(JSON.parse(payload.body ?? "{}")).toEqual({
        text: "Good morning",
        source: "tw",
        target: "en",
        api_name: "lelapa",
        api_key: "tok_live",
      })
    })

    it("sends several checks in parallel after Submit", async () => {
      const user = userEvent.setup()
      render(<ProbeApp initialUrl={TRANSLATE_ENDPOINT} />)
      await waitForAuthCard()
      await enterAcceptedToken(user)

      await user.clear(screen.getByLabelText("Requests"))
      await user.type(screen.getByLabelText("Requests"), "3")
      await user.click(screen.getByRole("radio", { name: "Concurrent" }))

      const fetchMock = mockFetch(async () => jsonResponse(acceptedTokenResult))
      await submitCheck(user)
      await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(3))
      const table = screen.getByRole("table", { name: "Request results" })
      expect(within(table).getByRole("columnheader", { name: "Status" })).toBeInTheDocument()
      expect(within(table).getAllByRole("row")).toHaveLength(4)
      expect(within(table).getAllByText("200")).toHaveLength(3)
      expect(within(table).getAllByText("120 ms")).toHaveLength(3)
      expect(within(table).getAllByText("healthy")).toHaveLength(3)
      expect(
        screen.getByRole("heading", { name: "Your request succeeded in 120 ms" }),
      ).toBeInTheDocument()
      expect(screen.getByText("The response arrived in 120 ms")).toBeInTheDocument()
      expect(screen.getByRole("combobox", { name: "Request to inspect" })).toHaveTextContent(
        "Request 1",
      )
    })

    it("averages multi-request times and lets you inspect each response", async () => {
      const user = userEvent.setup()
      render(<ProbeApp initialUrl={TRANSLATE_ENDPOINT} />)
      await waitForAuthCard()
      await enterAcceptedToken(user)

      await user.clear(screen.getByLabelText("Requests"))
      await user.type(screen.getByLabelText("Requests"), "3")

      const timed = [100, 200, 300].map((durationMs, index) => ({
        ...acceptedTokenResult,
        response: {
          ...acceptedTokenResult.response!,
          durationMs,
          body: JSON.stringify({ translatedText: `Run ${index + 1}` }),
        },
      }))
      let call = 0
      mockFetch(async () => jsonResponse(timed[call++] ?? timed[2]))
      await submitCheck(user)

      expect(
        await screen.findByRole("heading", { name: "Your request succeeded in 200 ms" }),
      ).toBeInTheDocument()
      expect(screen.getByText("The response arrived in 200 ms")).toBeInTheDocument()
      expect(screen.getByText(/200 OK/)).toBeInTheDocument()
      expect(document.querySelector("pre code")?.textContent).toContain('"translatedText": "Run 1"')

      await user.click(screen.getByRole("combobox", { name: "Request to inspect" }))
      await user.click(await screen.findByRole("option", { name: "Request 3" }))
      expect(document.querySelector("pre code")?.textContent).toContain('"translatedText": "Run 3"')
      const firstRow = screen.getByRole("row", { name: /Request 1/ })
      firstRow.focus()
      await user.keyboard("{Enter}")
      expect(document.querySelector("pre code")?.textContent).toContain('"translatedText": "Run 1"')
      expect(screen.getByText(/200 OK/)).toBeInTheDocument()
    })

    it("runs a request test and shows diagnosis and health", async () => {
      const user = userEvent.setup()
      render(<ProbeApp initialUrl={TRANSLATE_ENDPOINT} />)
      await waitForAuthCard()
      await enterAcceptedToken(user)

      expect(
        screen.queryByRole("heading", { name: /Your request succeeded/ }),
      ).not.toBeInTheDocument()
      mockFetch(async () => jsonResponse(acceptedTokenResult))
      await submitCheck(user)

      expect(
        await screen.findByRole("heading", { name: "Your request succeeded in 120 ms" }),
      ).toBeInTheDocument()
      expect(screen.queryByText("Results below")).not.toBeInTheDocument()
      expect(screen.getByText("At a glance")).toBeInTheDocument()
      expect(screen.getByText("The host was reached with HTTP 200")).toBeInTheDocument()
      expect(screen.getByText("The authentication token was accepted")).toBeInTheDocument()
      expect(screen.getByText("The response arrived in 120 ms")).toBeInTheDocument()
      expect(screen.queryByText(/under the .*threshold/)).not.toBeInTheDocument()
      expect(screen.getByText("Response details")).toBeInTheDocument()
      expect(screen.getByText(/200 OK/)).toBeInTheDocument()
      expect(document.querySelector("pre code")?.textContent).toContain('"translatedText": "Agoo"')
      expect(screen.queryByText(/translatedText is non-empty/)).not.toBeInTheDocument()
      expect(screen.queryByText("Require these fields")).not.toBeInTheDocument()
      expect(screen.queryByRole("heading", { name: /This session/ })).not.toBeInTheDocument()

      const fetchMock = mockFetch(async () => jsonResponse(acceptedTokenResult))
      await user.click(screen.getByRole("button", { name: "Retest" }))
      await waitFor(() => expect(fetchMock).toHaveBeenCalled())

      expect(screen.queryByRole("heading", { name: /This session/ })).not.toBeInTheDocument()
      expect(screen.queryByRole("table", { name: "Request results" })).not.toBeInTheDocument()
    })

    it("saves a request test without the token", async () => {
      const user = userEvent.setup()
      render(
        <SavedTestsProvider>
          <ProbeApp initialUrl={TRANSLATE_ENDPOINT} />
        </SavedTestsProvider>,
      )
      await waitForAuthCard()
      await enterAcceptedToken(user)

      mockFetch(async () => jsonResponse(acceptedTokenResult))
      await submitCheck(user)

      await waitFor(() => {
        const stored = readSavedTests()
        expect(stored[0]?.url).toBe(TRANSLATE_ENDPOINT)
        expect(stored[0]?.title).toBe("Translation succeeded")
      })
      expect(JSON.stringify(readSavedTests())).not.toMatch(/tok_live/)
    })
  })
})
