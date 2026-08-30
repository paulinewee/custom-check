import { ProbeApp } from "@/components/probe-app"

export default async function Home({
  searchParams,
}: {
  searchParams: Promise<{ url?: string }>
}) {
  const params = await searchParams

  return (
    <main
      id="main"
      tabIndex={-1}
      className="mx-auto w-full max-w-2xl flex-1 px-4 py-10 outline-none sm:px-6 sm:py-14"
    >
      <ProbeApp initialUrl={params.url?.trim() ?? ""} />
    </main>
  )
}
