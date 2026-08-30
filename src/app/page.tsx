import { ProbeApp } from "@/components/probe-app"

export default async function Home({
  searchParams,
}: {
  searchParams: Promise<{ url?: string }>
}) {
  const params = await searchParams

  return <ProbeApp initialUrl={params.url?.trim() ?? ""} />
}