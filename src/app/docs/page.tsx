import type { Metadata } from "next"

import { DocsArticle } from "@/components/docs-article"
import { DocsToc } from "@/components/docs-toc"
import { APP_NAME } from "@/lib/brand"
import { DOC_SECTIONS } from "@/lib/docs"

export const metadata: Metadata = {
  title: `Documentation · ${APP_NAME}`,
  description: `How ${APP_NAME} checks a GhanaNLP-shaped translation API.`,
}

export default function DocsPage() {
  return (
    <main id="main" tabIndex={-1} className="min-w-0 flex-1 outline-none">
      <div className="flex w-full flex-col-reverse gap-10 px-4 py-10 sm:px-6 sm:py-14 lg:flex-row lg:items-start lg:gap-16 lg:px-10">
        <DocsArticle />
        <DocsToc sections={DOC_SECTIONS} />
      </div>
    </main>
  )
}
