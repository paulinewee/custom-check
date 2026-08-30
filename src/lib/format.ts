const numberFormatter = new Intl.NumberFormat(undefined, { maximumFractionDigits: 0 })

export function formatMs(value: number): string {
  return `${numberFormatter.format(value)} ms`
}

export function formatTextStats(text: string) {
  const words = text.trim() === "" ? 0 : text.trim().split(/\s+/).length
  const characters = [...text].length
  const wordLabel = words === 1 ? "word" : "words"
  const charLabel = characters === 1 ? "character" : "characters"
  return `${words} ${wordLabel}, ${characters} ${charLabel}`
}
