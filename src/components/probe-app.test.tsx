import { render, screen, waitFor, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import { SavedTestsProvider } from "@/components/saved-tests-context"
import { TRANSLATE_ENDPOINT } from "@/lib/probe/constants"
import { readSavedTests } from "@/lib/saved-tests"
import {
  acceptedTokenResult,
  jsonResponse,
  languagesResult,
  rejectedTokenResult,
} from "@/test/fixtures"

import { ProbeApp } from "./probe-app"

const GHANA_LANGUAGES_URL = "https://translation-api.ghananlp.org/v2/languages"
const KHAYA_TRANSLATE_URL = "https://api.khaya.ai/v2/translate"

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

function mockGhanaNlpApi() {
  return mockFetch(async (_url, init) => {
    const payload = requestPayload([_url, init])
    if (payload.method === "GET" || payload.url?.includes("/languages")) {
      return jsonResponse(languagesResult)
    }
    return jsonResponse(acceptedTokenResult)
  })
}

async function typeEndpoint(user: ReturnType<typeof userEvent.setup>, url: string) {
  const input = screen.getByRole("textbox", { name: "Endpoint" })
  await user.clear(input)
  await user.type(input, url)
}

async function waitForAuthCard() {
  return screen.findByRole("heading", {
    name: /Your endpoint requires an authentication token/,
  })
}

async function enterAcceptedToken(user: ReturnType<typeof userEvent.setup>) {
  mockGhanaNlpApi()
  await user.type(screen.getByLabelText("Authentication token"), "tok_live")
  await screen.findByRole("heading", { name: /Customize your check/ })
}

async function waitForGhanaLanguages() {
  await waitFor(() => {
    expect(screen.getByLabelText("Source Language").tagName).toBe("SELECT")
    expect(screen.getByLabelText("Target Language").tagName).toBe("SELECT")
    expect(screen.getAllByRole("option", { name: /^English \(en\)$/ }).length).toBeGreaterThan(0)
  })
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
        screen.getByRole("heading", { level: 1, name: "Run a custom check on an endpoint" }),
      ).toBeInTheDocument()
      expect(
        screen.getByText("Create custom requests to test an endpoint for your workflow."),
      ).toBeInTheDocument()

      const endpoint = screen.getByRole("textbox", { name: "Endpoint" })
      expect(endpoint).toHaveAttribute("placeholder", "http://")
      expect(endpoint).toHaveValue("")

      expect(
        screen.queryByRole("heading", {
          name: /Your endpoint requires an authentication token/,
        }),
      ).not.toBeInTheDocument()
      expect(screen.queryByRole("heading", { name: /Customize your check/ })).not.toBeInTheDocument()
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

      await typeEndpoint(user, "not-a-url")

      expect(screen.getByRole("alert")).toHaveTextContent("That is not a valid URL.")
      expect(screen.queryByLabelText("Authentication token")).not.toBeInTheDocument()
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
      mockGhanaNlpApi()
      render(<ProbeApp initialUrl="" />)

      await typeEndpoint(user, "http://localhost:3000/api/practice/v2/translate")
      await waitForAuthCard()

      expect(screen.getByLabelText("Authentication token")).toBeInTheDocument()
    })
  })

  describe("GhanaNLP endpoint", () => {
    it("reveals the auth card after a valid GhanaNLP translate URL", async () => {
      const user = userEvent.setup()
      render(<ProbeApp initialUrl="" />)

      await typeEndpoint(user, TRANSLATE_ENDPOINT)
      await waitForAuthCard()

      expect(screen.getByLabelText("Authentication token")).toHaveAttribute(
        "placeholder",
        "eyJhbGci…",
      )
      expect(screen.queryByRole("heading", { name: /Customize your check/ })).not.toBeInTheDocument()
    })

    it("opens the GhanaNLP translate URL when it is already valid", async () => {
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

      expect(screen.getByRole("alert")).toHaveTextContent(
        "Enter an authentication token. Paste the value from your provider.",
      )
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
      expect(body.auth?.headerName).toBe("Ocp-Apim-Subscription-Key")
      expect(payloads(fetchMock).some((item) => item.url === GHANA_LANGUAGES_URL)).toBe(false)

      expect(
        await screen.findByText("That token was rejected. Check the value and try again."),
      ).toBeInTheDocument()
      expect(screen.getByLabelText("Authentication token")).toBeInTheDocument()
      expect(screen.queryByRole("heading", { name: /Customize your check/ })).not.toBeInTheDocument()
    })

    it("opens an info note on click and closes it with Escape", async () => {
      const user = userEvent.setup()
      render(<ProbeApp initialUrl={TRANSLATE_ENDPOINT} />)
      await waitForAuthCard()

      const tip = screen.getByRole("button", { name: "About authentication tokens" })
      expect(tip).toHaveAttribute("aria-expanded", "false")

      await user.click(tip)
      expect(tip).toHaveAttribute("aria-expanded", "true")
      expect(screen.getByRole("note")).toHaveTextContent("A secret the provider issued")

      await user.keyboard("{Escape}")
      expect(tip).toHaveAttribute("aria-expanded", "false")
      expect(screen.queryByRole("note")).not.toBeInTheDocument()
    })

    it("collapses auth after an accepted token and does not show results yet", async () => {
      const user = userEvent.setup()
      render(<ProbeApp initialUrl={TRANSLATE_ENDPOINT} />)
      await waitForAuthCard()
      await enterAcceptedToken(user)

      expect(screen.getByText("Authentication Token")).toBeInTheDocument()
      expect(
        screen.queryByRole("heading", {
          name: /Your endpoint requires an authentication token/,
        }),
      ).not.toBeInTheDocument()
      expect(screen.getByRole("button", { name: "Submit" })).toBeInTheDocument()
      expect(
        screen.queryByRole("heading", { name: /Your request succeeded/ }),
      ).not.toBeInTheDocument()
      expect(screen.queryByRole("heading", { name: /This session/ })).not.toBeInTheDocument()
    })
  })

  describe("customize check", () => {
    it("shows GhanaNLP translate fields and send parameters", async () => {
      const user = userEvent.setup()
      render(<ProbeApp initialUrl={TRANSLATE_ENDPOINT} />)
      await waitForAuthCard()
      await enterAcceptedToken(user)

      expect(screen.getByText("Customize your request and payload")).toBeInTheDocument()
      expect(screen.queryByRole("radio", { name: "GET" })).not.toBeInTheDocument()
      expect(screen.queryByRole("radio", { name: "POST" })).not.toBeInTheDocument()
      expect(screen.getByLabelText("Input")).toHaveValue("Hello")
      expect(screen.getByLabelText("Source Language")).toHaveValue("en")
      expect(screen.getByLabelText("Target Language")).toHaveValue("tw")
      expect(screen.queryByLabelText("in")).not.toBeInTheDocument()
      expect(screen.queryByLabelText("lang")).not.toBeInTheDocument()
      expect(screen.getByLabelText("Format")).toHaveValue("application/json")
      expect(screen.getByLabelText("Requests")).toHaveValue(1)
      expect(screen.getByLabelText("Maximum delay")).toHaveValue(2000)
      expect(screen.getByRole("radio", { name: "One by one" })).toBeChecked()
      expect(screen.queryByLabelText("Delay between requests (ms)")).not.toBeInTheDocument()

      const preview = document.querySelector("pre")
      expect(preview?.textContent).toMatch(/curl -X POST/)
      expect(preview?.textContent).toContain(TRANSLATE_ENDPOINT)
      expect(preview?.textContent).toMatch(/Ocp-Apim-Subscription-Key/)
      expect(preview?.textContent).toMatch(/"in": "Hello"/)
      expect(preview?.textContent).toMatch(/"lang": "en-tw"/)
    })

    it("uses the same GhanaNLP fields for a Khaya host", async () => {
      const user = userEvent.setup()
      render(<ProbeApp initialUrl={KHAYA_TRANSLATE_URL} />)
      await waitForAuthCard()
      await enterAcceptedToken(user)

      expect(screen.getByLabelText("Input")).toHaveValue("Hello")
      expect(screen.getByLabelText("Source Language")).toHaveValue("en")
      expect(screen.getByLabelText("Target Language")).toHaveValue("tw")
      expect(screen.queryByLabelText("input_text")).not.toBeInTheDocument()
    })

    it("fills Source Language and Target Language from GET /v2/languages", async () => {
      const user = userEvent.setup()
      render(<ProbeApp initialUrl={TRANSLATE_ENDPOINT} />)
      await waitForAuthCard()
      await enterAcceptedToken(user)
      await waitForGhanaLanguages()

      expect(screen.getByLabelText("Source Language")).toHaveValue("en")
      expect(screen.getByLabelText("Target Language")).toHaveValue("tw")
      expect(screen.getAllByRole("option", { name: /^Twi \(tw\)$/ })).toHaveLength(2)
      expect(screen.getAllByRole("option", { name: /^Ga \(ga\)$/ })).toHaveLength(2)
      expect(screen.getAllByRole("option", { name: /^Fante \(fat\)$/ })).toHaveLength(2)
      expect(screen.queryByRole("option", { name: /English → Twi/ })).not.toBeInTheDocument()

      const languageCalls = (fetch as unknown as ReturnType<typeof vi.fn>).mock.calls
        .map((call) => requestPayload(call))
        .filter((body) => body.url === GHANA_LANGUAGES_URL)
      expect(languageCalls).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            method: "GET",
            auth: expect.objectContaining({
              secret: "tok_live",
              headerName: "Ocp-Apim-Subscription-Key",
            }),
          }),
        ]),
      )
    })

    it("keeps language fields as text when /languages is empty", async () => {
      const user = userEvent.setup()
      mockFetch(async (_url, init) => {
        const payload = requestPayload([_url, init])
        if (payload.method === "GET" || payload.url?.includes("/languages")) {
          return jsonResponse({
            ...acceptedTokenResult,
            response: {
              ...acceptedTokenResult.response!,
              body: "{}",
            },
          })
        }
        return jsonResponse(acceptedTokenResult)
      })
      render(<ProbeApp initialUrl={TRANSLATE_ENDPOINT} />)
      await waitForAuthCard()
      await user.type(screen.getByLabelText("Authentication token"), "tok_live")
      await screen.findByRole("heading", { name: /Customize your check/ })

      await waitFor(() => {
        expect(screen.getByLabelText("Source Language").tagName).toBe("INPUT")
        expect(screen.getByLabelText("Target Language").tagName).toBe("INPUT")
      })
      expect(screen.getByLabelText("Source Language")).toHaveValue("en")
      expect(screen.getByLabelText("Target Language")).toHaveValue("tw")
    })

    it("shows check fields with help on each GhanaNLP label", async () => {
      const user = userEvent.setup()
      render(<ProbeApp initialUrl={TRANSLATE_ENDPOINT} />)
      await waitForAuthCard()
      await enterAcceptedToken(user)

      expect(screen.getByRole("button", { name: "About Input" })).toBeInTheDocument()
      expect(screen.getByRole("button", { name: "About Source Language" })).toBeInTheDocument()
      expect(screen.getByRole("button", { name: "About Target Language" })).toBeInTheDocument()

      await user.click(screen.getByRole("button", { name: "About Input" }))
      expect(screen.getByRole("note")).toHaveTextContent("The phrase to translate")
    })

    it("describes the GhanaNLP JSON keys in raw mode", async () => {
      const user = userEvent.setup()
      render(<ProbeApp initialUrl={TRANSLATE_ENDPOINT} />)
      await waitForAuthCard()
      await enterAcceptedToken(user)

      await user.click(screen.getByRole("button", { name: "Edit JSON" }))
      expect(screen.getByLabelText("JSON")).toHaveValue(`{
  "in": "Hello",
  "lang": "en-tw"
}`)
      await user.click(screen.getByRole("button", { name: "About the JSON" }))
      expect(screen.getByRole("note")).toHaveTextContent("Keys for this API are in, lang")
    })

    it("reveals the delay field for With a delay", async () => {
      const user = userEvent.setup()
      render(<ProbeApp initialUrl={TRANSLATE_ENDPOINT} />)
      await waitForAuthCard()
      await enterAcceptedToken(user)

      await user.click(screen.getByRole("radio", { name: "With a delay" }))
      expect(screen.getByLabelText("Delay between requests (ms)")).toHaveValue(500)
    })
  })

  describe("URL changes", () => {
    it("rechecks the token and refetches /languages", async () => {
      const user = userEvent.setup()
      render(<ProbeApp initialUrl={TRANSLATE_ENDPOINT} />)
      await waitForAuthCard()
      await enterAcceptedToken(user)

      expect(screen.getByRole("heading", { name: /Customize your check/ })).toBeInTheDocument()

      const fetchMock = mockGhanaNlpApi()
      await typeEndpoint(user, "https://example.com/v2/translate")

      expect(screen.queryByRole("heading", { name: /Customize your check/ })).not.toBeInTheDocument()
      expect(
        await screen.findByRole("heading", {
          name: /Your endpoint requires an authentication token/,
        }),
      ).toBeInTheDocument()

      await waitFor(() => {
        expect(
          payloads(fetchMock).some(
            (body) =>
              body.url === "https://example.com/v2/translate" && body.auth?.secret === "tok_live",
          ),
        ).toBe(true)
      })

      expect(await screen.findByRole("heading", { name: /Customize your check/ })).toBeInTheDocument()
      await waitFor(() => {
        expect(
          payloads(fetchMock).some(
            (body) => body.url === "https://example.com/v2/languages" && body.method === "GET",
          ),
        ).toBe(true)
      })
      expect(screen.getByLabelText("Input")).toHaveValue("Hello")
      expect(screen.getByLabelText("Source Language")).toHaveValue("en")
      expect(screen.getByLabelText("Target Language")).toHaveValue("fr")
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
      expect(fetchMock).not.toHaveBeenCalled()
    })

    it("blocks Submit when the JSON body is invalid", async () => {
      const user = userEvent.setup()
      render(<ProbeApp initialUrl={TRANSLATE_ENDPOINT} />)
      await waitForAuthCard()
      await enterAcceptedToken(user)

      await user.click(screen.getByRole("button", { name: "Edit JSON" }))
      await user.clear(screen.getByLabelText("JSON"))
      await user.type(screen.getByLabelText("JSON"), "{{")

      const fetchMock = mockFetch(async () => jsonResponse(acceptedTokenResult))
      await user.click(screen.getByRole("button", { name: "Submit" }))

      expect(screen.getByText(/not valid JSON/)).toBeInTheDocument()
      expect(fetchMock).not.toHaveBeenCalled()
    })

    it("blocks Submit when the latency threshold is invalid", async () => {
      const user = userEvent.setup()
      render(<ProbeApp initialUrl={TRANSLATE_ENDPOINT} />)
      await waitForAuthCard()
      await enterAcceptedToken(user)

      await user.clear(screen.getByLabelText("Maximum delay"))
      await user.type(screen.getByLabelText("Maximum delay"), "0")

      const fetchMock = mockFetch(async () => jsonResponse(acceptedTokenResult))
      await user.click(screen.getByRole("button", { name: "Submit" }))

      expect(screen.getByText(/at least 1 ms/)).toBeInTheDocument()
      expect(fetchMock).not.toHaveBeenCalled()
    })
  })

  describe("submit", () => {
    it("sends the GhanaNLP translate body with the chosen language pair", async () => {
      const user = userEvent.setup()
      render(<ProbeApp initialUrl={TRANSLATE_ENDPOINT} />)
      await waitForAuthCard()
      await enterAcceptedToken(user)
      await waitForGhanaLanguages()

      await user.clear(screen.getByLabelText("Input"))
      await user.type(screen.getByLabelText("Input"), "Good morning")
      await user.selectOptions(screen.getByLabelText("Source Language"), "tw")
      await user.selectOptions(screen.getByLabelText("Target Language"), "en")

      const fetchMock = mockFetch(async () => jsonResponse(acceptedTokenResult))
      await user.click(screen.getByRole("button", { name: "Submit" }))
      await waitFor(() => expect(fetchMock).toHaveBeenCalled())

      const payload = requestPayload(fetchMock.mock.calls[0])
      expect(payload.url).toBe(TRANSLATE_ENDPOINT)
      expect(payload.method).toBe("POST")
      expect(payload.auth?.secret).toBe("tok_live")
      expect(payload.auth?.headerName).toBe("Ocp-Apim-Subscription-Key")
      expect(JSON.parse(payload.body ?? "{}")).toEqual({
        in: "Good morning",
        lang: "tw-en",
      })
    })

    it("sends several checks in parallel after Submit", async () => {
      const user = userEvent.setup()
      render(<ProbeApp initialUrl={TRANSLATE_ENDPOINT} />)
      await waitForAuthCard()
      await enterAcceptedToken(user)

      await user.clear(screen.getByLabelText("Requests"))
      await user.type(screen.getByLabelText("Requests"), "3")
      await user.click(screen.getByRole("radio", { name: "In parallel" }))

      const fetchMock = mockFetch(async () => jsonResponse(acceptedTokenResult))
      await user.click(screen.getByRole("button", { name: "Submit" }))
      await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(3))
      expect(screen.getByText("1. 200 · 120 ms · healthy")).toBeInTheDocument()
      expect(screen.getByText("3. 200 · 120 ms · healthy")).toBeInTheDocument()
    })

    it("sends delayed checks one after another", async () => {
      const user = userEvent.setup()
      render(<ProbeApp initialUrl={TRANSLATE_ENDPOINT} />)
      await waitForAuthCard()
      await enterAcceptedToken(user)

      await user.clear(screen.getByLabelText("Requests"))
      await user.type(screen.getByLabelText("Requests"), "2")
      await user.click(screen.getByRole("radio", { name: "With a delay" }))
      await user.clear(screen.getByLabelText("Delay between requests (ms)"))
      await user.type(screen.getByLabelText("Delay between requests (ms)"), "0")

      const fetchMock = mockFetch(async () => jsonResponse(acceptedTokenResult))
      await user.click(screen.getByRole("button", { name: "Submit" }))
      await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2))
      expect(screen.getByText("1. 200 · 120 ms · healthy")).toBeInTheDocument()
      expect(screen.getByText("2. 200 · 120 ms · healthy")).toBeInTheDocument()
    })

    it("runs a request test and shows diagnosis, health, and session history", async () => {
      const user = userEvent.setup()
      render(<ProbeApp initialUrl={TRANSLATE_ENDPOINT} />)
      await waitForAuthCard()
      await enterAcceptedToken(user)

      expect(
        screen.queryByRole("heading", { name: /Your request succeeded/ }),
      ).not.toBeInTheDocument()
      mockFetch(async () => jsonResponse(acceptedTokenResult))
      await user.click(screen.getByRole("button", { name: "Submit" }))

      expect(
        await screen.findByRole("heading", { name: "Your request succeeded in 120 ms" }),
      ).toBeInTheDocument()
      expect(screen.getByText("Results below")).toBeInTheDocument()
      expect(screen.getByText("What we checked")).toBeInTheDocument()
      expect(screen.getByText("The host was reached with HTTP 200")).toBeInTheDocument()
      expect(screen.getByText("The authentication token was accepted")).toBeInTheDocument()
      expect(
        screen.getByText("The response arrived in 120 ms, under the 2000 ms threshold"),
      ).toBeInTheDocument()
      expect(screen.getByText("What came back")).toBeInTheDocument()
      expect(screen.getByText(/200 OK/)).toBeInTheDocument()
      expect(document.querySelector("pre code")?.textContent).toContain('"translatedText": "Agoo"')
      expect(screen.getByText(/translatedText is non-empty/)).toBeInTheDocument()

      const fetchMock = mockFetch(async () => jsonResponse(acceptedTokenResult))
      await user.click(screen.getByRole("button", { name: "Retest" }))
      await waitFor(() => expect(fetchMock).toHaveBeenCalled())

      const session = screen.getByRole("heading", { name: /This session/ }).closest("section")
      expect(session).toBeTruthy()
      expect(within(session as HTMLElement).getAllByText(/200 · 120 ms · healthy/)).toHaveLength(2)
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
      await user.click(screen.getByRole("button", { name: "Submit" }))

      await waitFor(() => {
        const stored = readSavedTests()
        expect(stored[0]?.url).toBe(TRANSLATE_ENDPOINT)
        expect(stored[0]?.title).toBe("Translation succeeded")
      })
      expect(JSON.stringify(readSavedTests())).not.toMatch(/tok_live/)
    })
  })
})
