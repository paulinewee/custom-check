import { PageSkeleton } from "@/components/page-skeleton"

export default function Loading() {
  return (
    <div aria-busy="true">
      <span className="sr-only" role="status" aria-live="polite">
        Loading…
      </span>
      <PageSkeleton showInput />
    </div>
  )
}
