const timeFormatter = new Intl.DateTimeFormat(undefined, {
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
  fractionalSecondDigits: 3,
  hour12: false,
})

const numberFormatter = new Intl.NumberFormat(undefined, { maximumFractionDigits: 0 })

export function formatClock(at: number): string {
  return timeFormatter.format(at)
}

export function formatMs(value: number): string {
  return `${numberFormatter.format(value)} ms`
}

export function formatBytes(value: number): string {
  if (value < 1024) return `${numberFormatter.format(value)} B`
  return `${new Intl.NumberFormat(undefined, { maximumFractionDigits: 1 }).format(value / 1024)} KB`
}
