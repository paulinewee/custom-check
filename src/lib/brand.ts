export const APP_NAME = "Custom Check"
export const APP_SLUG = "custom-check"
export const APP_HEADLINE = "Put your translation API to the test."
export const APP_DESCRIPTION =
  "Quickly check capabilities, performance, and failures before integration."

export function siteUrl() {
  const explicit = process.env.NEXT_PUBLIC_SITE_URL
  if (explicit) return new URL(explicit)
  const vercel = process.env.VERCEL_PROJECT_PRODUCTION_URL
  if (vercel) return new URL(`https://${vercel}`)
  return new URL("http://localhost:3000")
}
