import { cn } from "@/lib/utils"

const TOKEN =
  /("(?:\\u[\da-fA-F]{4}|\\.|[^"\\])*")(\s*:)?|(-?(?:0|[1-9]\d*)(?:\.\d+)?(?:[eE][+-]?\d+)?)|\b(true|false|null)\b|(\s+|[{}\[\]:,])/g

export function highlightJson(source: string) {
  const parts: { className?: string; text: string }[] = []
  let last = 0
  for (const match of source.matchAll(new RegExp(TOKEN, "g"))) {
    const index = match.index ?? 0
    if (index > last) parts.push({ text: source.slice(last, index) })
    const [, str, keyColon, num, keyword, punct] = match
    if (str !== undefined) {
      parts.push({
        className: keyColon !== undefined ? "text-violet-300" : "text-emerald-400",
        text: str,
      })
      if (keyColon) parts.push({ className: "text-zinc-400", text: keyColon })
    } else if (num) {
      parts.push({ text: num })
    } else if (keyword) {
      parts.push({ className: "text-pink-400", text: keyword })
    } else if (punct) {
      parts.push({ className: "text-zinc-400", text: punct })
    }
    last = index + match[0].length
  }
  if (last < source.length) parts.push({ text: source.slice(last) })
  return parts
}

export function CodeBlock({
  code,
  className,
}: {
  code: string
  className?: string
}) {
  const parts = /^\s*[{\[]/.test(code) ? highlightJson(code) : [{ text: code }]

  return (
    <pre
      translate="no"
      tabIndex={0}
      className={cn(
        "overflow-auto overscroll-contain rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-2 font-mono text-xs break-words whitespace-pre-wrap text-zinc-100 focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50",
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
