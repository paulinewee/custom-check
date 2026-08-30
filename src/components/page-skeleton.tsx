import { Skeleton } from "@/components/ui/skeleton"

export function PageSkeleton({
  cards = 2,
  showInput = false,
}: {
  cards?: number
  showInput?: boolean
}) {
  return (
    <div className="space-y-8" aria-hidden>
      <div className="space-y-3">
        <Skeleton className="h-8 w-56 max-w-full" />
        <Skeleton className="h-4 w-80 max-w-[90%]" />
      </div>
      {showInput ? <Skeleton className="h-9 w-full rounded-lg" /> : null}
      {Array.from({ length: cards }, (_, index) => (
        <Skeleton key={index} className="h-40 w-full rounded-xl" />
      ))}
    </div>
  )
}