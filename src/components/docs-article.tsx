import { CodeBlock } from "@/components/code-block"
import { InlineCode } from "@/components/inline-code"
import { DOC_SECTIONS, DOCS } from "@/lib/docs"

function Section({
  id,
  children,
}: {
  id: (typeof DOC_SECTIONS)[number]["id"]
  children: React.ReactNode
}) {
  const title = DOC_SECTIONS.find((section) => section.id === id)?.title ?? id
  return (
    <section aria-labelledby={id}>
      <h2 id={id} className="scroll-mt-24 text-pretty text-xl font-semibold tracking-tight">
        {title}
      </h2>
      <div className="mt-4 space-y-4 text-pretty text-sm leading-7 text-muted-foreground">
        {children}
      </div>
    </section>
  )
}

function Lead({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <li>
      <strong className="font-medium text-foreground">{`${label}.`}</strong> {children}
    </li>
  )
}

export function DocsArticle() {
  return (
    <article className="min-w-0 w-full flex-1">
      <header className="space-y-3">
        <h1 className="text-pretty text-3xl font-semibold tracking-tight">Documentation</h1>
        <p className="text-pretty text-base leading-7 text-muted-foreground">
          Custom Check checks a GhanaNLP-shaped translation API. You build a request, prove the
          endpoint is reachable and authenticated, then see what came back.
        </p>
      </header>

      <div className="mt-12 space-y-14">
        <Section id="how-a-check-works">
          <p>A check is a short loop. Each step stays hidden until the one before it works.</p>
          <ol className="list-decimal space-y-3 pl-5">
            <Lead label="Endpoint">
              Enter the translate URL. GhanaNLP lives at{" "}
              <InlineCode>{DOCS.translateUrl}</InlineCode>.
            </Lead>
            <Lead label="Token">
              Paste the subscription key. Custom Check sends it as{" "}
              <InlineCode>{DOCS.headerName}</InlineCode> and checks whether the host accepts it.
            </Lead>
            <Lead label="Languages">
              After the token is accepted, Custom Check runs <InlineCode>GET</InlineCode>{" "}
              <InlineCode>{DOCS.languagesUrl}</InlineCode> and fills Source Language and Target
              Language.
            </Lead>
            <Lead label="Submit">
              The functional <InlineCode>{DOCS.method}</InlineCode> runs only when you press Submit.
              Auth and language fetches are not stored as results.
            </Lead>
          </ol>
        </Section>

        <Section id="ghananlp-api-shape">
          <p>
            The request Custom Check sends is the GhanaNLP Translation v2 shape: a{" "}
            <InlineCode>{DOCS.method}</InlineCode> to the translate path with JSON{" "}
            <InlineCode>in</InlineCode> and <InlineCode>lang</InlineCode>.
          </p>
          <CodeBlock code={DOCS.sampleBody} />
          <ul className="list-disc space-y-3 pl-5">
            <Lead label="in">
              The phrase to translate. The form label is Input. Sample:{" "}
              <InlineCode>{DOCS.sampleInput}</InlineCode>.
            </Lead>
            <Lead label="lang">
              A source–target pair. The form splits this into Source Language{" "}
              <InlineCode>{DOCS.sampleSource}</InlineCode> and Target Language{" "}
              <InlineCode>{DOCS.sampleTarget}</InlineCode>, then sends{" "}
              <InlineCode>{DOCS.sampleLang}</InlineCode>.
            </Lead>
          </ul>
        </Section>

        <Section id="languages">
          <p>
            Supported codes come from <InlineCode>GET {DOCS.languagesUrl}</InlineCode> on the same
            host and version as the translate URL. A typical body is a map of code to name:
          </p>
          <CodeBlock
            code={JSON.stringify(
              { languages: { en: "English", tw: "Twi", ee: "Ewe", ga: "Ga" } },
              null,
              2,
            )}
          />
          <p>
            If that request is empty or fails, Source Language and Target Language stay text
            fields so you can still type a code.
          </p>
        </Section>

        <Section id="authentication">
          <p>
            GhanaNLP and Khaya expect an Azure APIM subscription key in{" "}
            <InlineCode>{DOCS.headerName}</InlineCode>. Custom Check never writes the token to
            localStorage or saved tests. It lives in this browser tab only.
          </p>
          <p>
            A rejected token keeps the auth card open. An accepted token collapses it and unlocks
            Customize your check.
          </p>
        </Section>

        <Section id="test-api">
          <p>
            The browser does not call GhanaNLP directly. Every check goes through Custom Check&apos;s
            test API, which forwards the request from the server so CORS and secrets stay off the
            page.
          </p>
          <p>
            <InlineCode>POST</InlineCode> <InlineCode>{DOCS.testApiPath}</InlineCode> accepts the
            same fields the form
            already built, then runs them against the public URL you entered.
          </p>
          <CodeBlock
            code={JSON.stringify(
              {
                url: DOCS.translateUrl,
                method: DOCS.method,
                auth: {
                  kind: "api_key",
                  headerName: DOCS.headerName,
                  secret: "your-subscription-key",
                },
                headers: { "Content-Type": "application/json" },
                body: JSON.parse(DOCS.sampleBody) as Record<string, string>,
                latencyMs: DOCS.defaultLatencyMs,
              },
              null,
              2,
            )}
          />
          <p>
            Language listing uses the same route with <InlineCode>method: "GET"</InlineCode> and
            no body, pointed at <InlineCode>{DOCS.languagesUrl}</InlineCode>.
          </p>
        </Section>

        <Section id="customize-fields">
          <p>The form shows human labels. The JSON that leaves the app still uses API keys.</p>
          <ul className="list-disc space-y-3 pl-5">
            <Lead label="Input">
              Maps to <InlineCode>in</InlineCode>. Sample{" "}
              <InlineCode>{DOCS.sampleInput}</InlineCode>.
            </Lead>
            <Lead label="Source Language">
              First half of <InlineCode>lang</InlineCode>. Sample{" "}
              <InlineCode>{DOCS.sampleSource}</InlineCode>.
            </Lead>
            <Lead label="Target Language">
              Second half of <InlineCode>lang</InlineCode>. Sample{" "}
              <InlineCode>{DOCS.sampleTarget}</InlineCode>. Together they send{" "}
              <InlineCode>{DOCS.sampleLang}</InlineCode>.
            </Lead>
          </ul>
        </Section>

        <Section id="multiple-checks">
          <p>After the payload looks right, you can send it more than once.</p>
          <ul className="list-disc space-y-3 pl-5">
            <Lead label="Requests">
              How many times to send the same check, up to <InlineCode>{DOCS.maxRequests}</InlineCode>.
            </Lead>
            <Lead label="Maximum delay">
              Responses slower than <InlineCode>{DOCS.defaultLatencyMs} ms</InlineCode> count as
              degraded even when the body is correct.
            </Lead>
            <Lead label="How to send them">
              One by one waits for each response. In parallel sends them together. With a delay
              waits <InlineCode>{DOCS.defaultGapMs} ms</InlineCode> between sends.
            </Lead>
          </ul>
        </Section>

        <Section id="results">
          <p>Submit opens one results card. Auth and language fetches never appear here.</p>
          <ul className="list-disc space-y-3 pl-5">
            <Lead label="What we checked">
              Reachability, authentication, request shape, expected output, and response time.
            </Lead>
            <Lead label="What came back">The status line and the response body.</Lead>
            <Lead label="This session">
              The last five submitted checks in this tab. Nothing is stored after you leave.
            </Lead>
          </ul>
        </Section>
      </div>
    </article>
  )
}
