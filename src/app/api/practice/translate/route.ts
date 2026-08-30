import { parsePracticeCookie } from "@/lib/practice/config"
import { handlePracticeRequest } from "@/lib/practice/handler"

export const runtime = "nodejs"

export async function POST(request: Request) {
  return handlePracticeRequest(request, parsePracticeCookie(request.headers.get("cookie")))
}
