export function CustomCheckMark({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 20 20"
      className={className}
      aria-hidden
      focusable="false"
    >
      <polygon points="10,4 16,11 4,11" fill="currentColor" />
      <polygon points="10,8 16,15 4,15" fill="currentColor" />
    </svg>
  )
}
