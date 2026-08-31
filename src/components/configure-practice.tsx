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
  PRACTICE_STORAGE_KEY,
  PRACTICE_TOKEN,
  PRACTICE_TRANSLATE_PATH,
  practiceTranslateUrl,
  readStoredPracticeConfig,
  serializePracticeCookie,
  type PracticeConfig,
  type PracticeToggle,
} from "@/lib/practice/config"
import { Separator } from "@/components/ui/separator"
import { cn } from "@/lib/utils"

const TOGGLES: ReadonlyArray<{ key: keyof PracticeToggle; label: string }> = [
  { key: "reachable", label: "The endpoint is reachable." },
  { key: "authenticated", label: "Authentication succeeds." },
  { key: "requestValid", label: "The request shape is accepted." },
  { key: "expectedOutput", label: "The expected output is returned." },
  { key: "latency", label: "The response time is acceptable." },
]

function persist(config: PracticeConfig) {
  try {
    window.localStorage.setItem(PRACTICE_STORAGE_KEY, JSON.stringify(config))
  } catch {
    /* ignore quota / private mode */
  }
  document.cookie = serializePracticeCookie(config)
}

function WorkingSwitch({
  checked,
  label,
  onCheckedChange,
}: {
  checked: boolean
  label: string
  onCheckedChange: (next: boolean) => void
}) {
  return (
    <div className="flex items-center justify-between gap-4">
      <p className="text-sm font-normal">{label}</p>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        aria-label={label}
        onClick={() => onCheckedChange(!checked)}
        className={cn(
          "relative isolate inline-flex h-6 w-10 shrink-0 rounded-full outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
          checked ? "bg-foreground" : "bg-input",
        )}
      >
        <span
          aria-hidden
          className={cn(
            "pointer-events-none absolute top-0.5 left-0.5 size-5 rounded-full bg-background transition-transform duration-200 ease-in-out",
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
    const stored = readStoredPracticeConfig()
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
        <h1 className="scroll-mt-6 text-pretty text-2xl font-semibold tracking-tight">
          Test Endpoint
        </h1>
        <p className="max-w-xl text-pretty text-sm text-muted-foreground">
          Use this endpoint for testing in lieu of a live API service.
        </p>
      </header>

      <section className="space-y-4 rounded-xl border border-border bg-card px-4 py-4">
        <h2 className="text-sm font-medium">Test Endpoint</h2>
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <code translate="no" className="min-w-0 flex-1 truncate rounded-lg border border-border bg-muted/50 px-2.5 py-1.5 font-mono text-xs">
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
              Test
            </Link>
          </div>
        </div>
      </section>

      <section className="overflow-hidden rounded-xl border border-border bg-card">
        <h2 className="px-4 py-4 text-sm font-medium">Test Conditions</h2>
        <Separator />
        <ul className="divide-y divide-border">
          {TOGGLES.map((item) => (
            <li key={item.key} className="px-4 py-3">
              <WorkingSwitch
                checked={config[item.key]}
                label={item.label}
                onCheckedChange={(next) => update({ ...config, [item.key]: next })}
              />
            </li>
          ))}
        </ul>
      </section>

      <section className="space-y-3 rounded-xl border border-border bg-card px-4 py-4">
        <h2 className="text-sm font-medium">Test Authentication Token</h2>
        <Field>
          <Label htmlFor="practice-token" className="sr-only">
            Test Authentication Token
          </Label>
          <Input
            id="practice-token"
            name="token"
            value={tokenDraft}
            autoComplete="off"
            spellCheck={false}
            aria-label="Test Authentication Token"
            aria-invalid={Boolean(tokenError)}
            aria-describedby={tokenError ? "practice-token-error" : undefined}
            className="font-mono text-base md:text-xs"
            onChange={(event) => {
              const token = event.target.value
              setTokenDraft(token)
              setTokenError(token.trim() ? null : "Enter a token Home should send.")
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
