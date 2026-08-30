import type { ReactNode } from "react"

export function PageMain({ children }: { children: ReactNode }) {
  return (
    <main
      id="main"
      tabIndex={-1}
      className="mx-auto flex w-full min-w-0 max-w-2xl flex-1 scroll-mt-4 flex-col px-4 py-10 outline-none sm:px-6 sm:py-14"
    >
      {children}
    </main>
  )
}