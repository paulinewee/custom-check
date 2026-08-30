"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { Check, Copy } from "lucide-react"

import { buttonVariants } from "@/components/ui/button"
import { Field, FieldError } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  defaultPracticeConfig,
  parsePracticeConfig,
  parsePracticeCookie,
  PRACTICE_STORAGE_KEY,
  PRACTICE_TOKEN,
  PRACTICE_TRANSLATE_PATH,
  practiceTranslateUrl,
  serializePracticeCookie,
  type PracticeConfig,
  type PracticeToggle,
} from "@/lib/practice/config"
import { cn } from "@/lib/utils"

const TOGGLES: ReadonlyArray<{
  key: keyof PracticeToggle
  label: string
  on: string
  off: string
}> = [
  {
    key: "reachable",
    label: "Reachable",
    on: "The host answers.",
    off: "The connection is refused before a response.",
  },
  {
    key: "authenticated",
    label: "Authentication",
    on: "The accepted token is allowed.",
    off: "Every token is rejected with 401.",
  },
  {
    key: "languages",
    label: "Languages",
    on: "GET /v2/languages returns the GhanaNLP language map.",
    off: "The languages list fails, so Source and Target stay text fields.",
  },
  {
    key: "requestValid",
    label: "Request shape",
    on: "POST { in, lang } is accepted.",
    off: "A valid translate body is rejected with 400.",
  },
  {
    key: "expectedOutput",
    label: "Expected output",
    on: "The response includes translatedText.",
    off: "The response is 200 without a translation field.",
  },
  {
    key: "latency",
    label: "Response time",
    on: "The response is fast.",
    off: "The response waits past the 2000 ms threshold.",
  },
]

function persist(config: PracticeConfig) {
  try {
    window.localStorage.setItem(PRACTICE_STORAGE_KEY, JSON.stringify(config))
  } catch {
    /* ignore quota / private mode */
  }
  document.cookie = serializePracticeCookie(config)
}

function readStored(): PracticeConfig {
  try {
    const stored = window.localStorage.getItem(PRACTICE_STORAGE_KEY)
    if (stored) return parsePracticeConfig(stored)
  } catch {
    /* ignore */
  }
  return parsePracticeCookie(document.cookie)
}

function WorkingSwitch({
  checked,
  label,
  description,
  onCheckedChange,
}: {
  checked: boolean
  label: string
  description: string
  onCheckedChange: (next: boolean) => void
}) {
  return (
    <div className="flex items-start justify-between gap-4">
      <div className="min-w-0 space-y-1">
        <p className="text-sm font-medium">{label}</p>
        <p className="text-pretty text-xs leading-5 text-muted-foreground">{description}</p>
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        aria-label={label}
        onClick={() => onCheckedChange(!checked)}
        className={cn(
          "relative isolate mt-0.5 inline-flex h-6 w-10 shrink-0 rounded-full outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
          checked ? "bg-foreground" : "bg-input",
        )}
      >
        <span
          aria-hidden
          className={cn(
            "pointer-events-none absolute top-0.5 left-0.5 size-5 rounded-full bg-background transition-transform",
            checked ? "translate-x-4" : "translate-x-0",
          )}
        />
      </button>
    </div>
  )
}

export function ConfigurePractice() {
  const [origin, setOrigin] = useState("")
  const [config, setConfig] = useState<PracticeConfig>(defaultPracticeConfig)
  const [copied, setCopied] = useState(false)
  const [tokenDraft, setTokenDraft] = useState(PRACTICE_TOKEN)
  const [tokenError, setTokenError] = useState<string | null>(null)

  useEffect(() => {
    setOrigin(window.location.origin)
    const stored = readStored()
    setConfig(stored)
    setTokenDraft(stored.token)
  }, [])

  const translateUrl = origin ? practiceTranslateUrl(origin) : PRACTICE_TRANSLATE_PATH
  const overviewHref = origin ? `/?url=${encodeURIComponent(translateUrl)}` : "/"

  function update(next: PracticeConfig) {
    const parsed = parsePracticeConfig(next)
    setConfig(parsed)
    persist(parsed)
  }

  async function copyUrl() {
    if (!origin) return
    try {
      await navigator.clipboard.writeText(translateUrl)
      setCopied(true)
      window.setTimeout(() => setCopied(false), 1600)
    } catch {
      setCopied(false)
    }
  }

  return (
    <div className="space-y-8">
      <header className="space-y-2">
        <h1 className="text-pretty text-2xl font-semibold tracking-tight">
          Configure Test Endpoint
        </h1>
        <p className="max-w-xl text-pretty text-sm text-muted-foreground">
          This app hosts a GhanaNLP-shaped translate API. Toggle what works, then check it from
          Overview instead of the public GhanaNLP host.
        </p>
      </header>

      <section className="space-y-4 rounded-xl border border-border bg-card px-4 py-4">
        <div className="space-y-1">
          <h2 className="text-sm font-medium">Practice endpoint</h2>
          <p className="text-pretty text-xs leading-5 text-muted-foreground">
            Same path and body as GhanaNLP: <span className="font-mono">POST</span>{" "}
            <span className="font-mono">{PRACTICE_TRANSLATE_PATH}</span> with{" "}
            <span className="font-mono">{"{ in, lang }"}</span> and{" "}
            <span className="font-mono">Ocp-Apim-Subscription-Key</span>.
          </p>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <code className="min-w-0 flex-1 truncate rounded-lg border border-border bg-muted/50 px-2.5 py-1.5 font-mono text-xs">
            {translateUrl}
          </code>
          <div className="flex shrink-0 gap-2">
            <button
              type="button"
              onClick={copyUrl}
              className={buttonVariants({ variant: "outline" })}
            >
              {copied ? <Check aria-hidden /> : <Copy aria-hidden />}
              {copied ? "Copied" : "Copy URL"}
            </button>
            <Link href={overviewHref} className={buttonVariants()}>
              Test on Overview
            </Link>
          </div>
        </div>
      </section>

      <section className="space-y-4 rounded-xl border border-border bg-card px-4 py-4">
        <div className="space-y-1">
          <h2 className="text-sm font-medium">What works</h2>
          <p className="text-pretty text-xs leading-5 text-muted-foreground">
            Each switch maps to a check on Overview. Changes apply immediately to the next request.
          </p>
        </div>
        <ul className="divide-y divide-border">
          {TOGGLES.map((item) => (
            <li key={item.key} className="py-3 first:pt-0 last:pb-0">
              <WorkingSwitch
                checked={config[item.key]}
                label={item.label}
                description={config[item.key] ? item.on : item.off}
                onCheckedChange={(next) => update({ ...config, [item.key]: next })}
              />
            </li>
          ))}
        </ul>
      </section>

      <section className="space-y-3 rounded-xl border border-border bg-card px-4 py-4">
        <div className="space-y-1">
          <h2 className="text-sm font-medium">Accepted token</h2>
          <p className="text-pretty text-xs leading-5 text-muted-foreground">
            Paste this on Overview when Authentication is on. It is a practice value, not a real
            secret.
          </p>
        </div>
        <Field>
          <Label htmlFor="practice-token" className="sr-only">
            Accepted token
          </Label>
          <Input
            id="practice-token"
            name="token"
            value={tokenDraft}
            autoComplete="off"
            spellCheck={false}
            aria-label="Accepted token"
            aria-invalid={Boolean(tokenError)}
            aria-describedby={tokenError ? "practice-token-error" : undefined}
            className="font-mono text-xs md:text-xs"
            onChange={(event) => {
              const token = event.target.value
              setTokenDraft(token)
              setTokenError(token.trim() ? null : "Enter a token Overview should send.")
              if (token.trim()) update({ ...config, token: token.trim() })
            }}
            onBlur={() => {
              if (tokenDraft.trim()) return
              setTokenDraft(PRACTICE_TOKEN)
              setTokenError(null)
              update({ ...config, token: PRACTICE_TOKEN })
            }}
          />
          {tokenError ? <FieldError id="practice-token-error">{tokenError}</FieldError> : null}
        </Field>
      </section>
    </div>
  )
}
