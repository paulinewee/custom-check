import { cn } from "@/lib/utils"

type HighlightPart = { className?: string; text: string }

const TONE = {
  command: "text-sky-800 dark:text-sky-400",
  flag: "text-amber-800 dark:text-amber-400",
  method: "text-rose-800 dark:text-rose-400",
  string: "text-emerald-800 dark:text-emerald-400",
  key: "text-violet-800 dark:text-violet-300",
  keyword: "text-rose-800 dark:text-rose-400",
  punct: "text-muted-foreground",
} as const

const TOKEN =
  /("(?:\\u[\da-fA-F]{4}|\\.|[^"\\])*")(\s*:)?|(-?(?:0|[1-9]\d*)(?:\.\d+)?(?:[eE][+-]?\d+)?)|\b(true|false|null)\b|(\s+|[{}\[\]:,])/g

const CURL_TOKEN =
  /\b(curl)\b|(-[A-Za-z]+)\b|\b(GET|POST|PUT|PATCH|DELETE|HEAD|OPTIONS)\b|('(?:\\'|[^'])*')|("(?:\\.|[^"\\])*")|(\s+|\\)/g

export function highlightJson(source: string): HighlightPart[] {
  const parts: HighlightPart[] = []
  let last = 0
  for (const match of source.matchAll(new RegExp(TOKEN, "g"))) {
    const index = match.index ?? 0
    if (index > last) parts.push({ text: source.slice(last, index) })
    const [, str, keyColon, num, keyword, punct] = match
    if (str !== undefined) {
      parts.push({
        className: keyColon !== undefined ? TONE.key : TONE.string,
        text: str,
      })
      if (keyColon) parts.push({ className: TONE.punct, text: keyColon })
    } else if (num) {
      parts.push({ text: num })
    } else if (keyword) {
      parts.push({ className: TONE.keyword, text: keyword })
    } else if (punct) {
      parts.push({ className: TONE.punct, text: punct })
    }
    last = index + match[0].length
  }
  if (last < source.length) parts.push({ text: source.slice(last) })
  return parts
}

function highlightQuoted(quoted: string): HighlightPart[] {
  const quote = quoted[0]
  const inner = quoted.slice(1, -1)
  if (/^\s*[{\[]/.test(inner)) {
    return [
      { className: TONE.punct, text: quote },
      ...highlightJson(inner),
      { className: TONE.punct, text: quote },
    ]
  }
  const header = inner.match(/^([A-Za-z0-9-]+):\s+(.+)$/)
  if (header) {
    return [
      { className: TONE.punct, text: quote },
      { className: TONE.key, text: header[1] },
      { className: TONE.punct, text: ": " },
      { className: TONE.string, text: header[2] },
      { className: TONE.punct, text: quote },
    ]
  }
  return [{ className: TONE.string, text: quoted }]
}

export function highlightCurl(source: string): HighlightPart[] {
  const parts: HighlightPart[] = []
  let last = 0
  for (const match of source.matchAll(new RegExp(CURL_TOKEN, "g"))) {
    const index = match.index ?? 0
    if (index > last) parts.push({ text: source.slice(last, index) })
    const [, command, flag, method, single, double, punct] = match
    if (command) {
      parts.push({ className: TONE.command, text: command })
    } else if (flag) {
      parts.push({ className: TONE.flag, text: flag })
    } else if (method) {
      parts.push({ className: TONE.method, text: method })
    } else if (single || double) {
      parts.push(...highlightQuoted(single ?? double))
    } else if (punct) {
      parts.push({ className: TONE.punct, text: punct })
    }
    last = index + match[0].length
  }
  if (last < source.length) parts.push({ text: source.slice(last) })
  return parts
}

function highlightCode(code: string): HighlightPart[] {
  if (/^\s*curl\b/.test(code)) return highlightCurl(code)
  if (/^\s*[{\[]/.test(code)) return highlightJson(code)
  return [{ text: code }]
}

export function CodeBlock({
  code,
  className,
}: {
  code: string
  className?: string
}) {
  const parts = highlightCode(code)

  return (
    <pre
      translate="no"
      tabIndex={0}
      className={cn(
        "overflow-auto overscroll-contain rounded-lg border border-border bg-muted/40 px-3 py-2 font-mono text-xs break-words whitespace-pre-wrap text-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50",
        className,
      )}
    >
      <code>
        {parts.map((part, index) => (
          <span key={index} className={part.className}>
            {part.text}
          </span>
        ))}
      </code>
    </pre>
  )
}
