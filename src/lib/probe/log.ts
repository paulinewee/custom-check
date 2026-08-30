import type { LogLevel, ProcessLog } from "@/lib/probe/types"

export function createLog(
  level: LogLevel,
  message: string,
  detail?: string,
): ProcessLog {
  return {
    id: crypto.randomUUID(),
    at: Date.now(),
    level,
    message,
    detail,
  }
}

export function maskSecret(value: string | undefined): string | undefined {
  if (!value) return value
  if (value.length <= 4) return "••••"
  return `••••${value.slice(-4)}`
}
