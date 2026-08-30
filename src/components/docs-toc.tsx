"use client"

import { useEffect, useState } from "react"

import type { DocSection } from "@/lib/docs"
import { cn } from "@/lib/utils"

export function DocsToc({ sections }: { sections: readonly DocSection[] }) {
  const [activeId, setActiveId] = useState(sections[0]?.id ?? "")

  useEffect(() => {
    function onScroll() {
      let current = sections[0]?.id ?? ""
      for (const section of sections) {
        const node = document.getElementById(section.id)
        if (node && node.getBoundingClientRect().top <= 120) {
          current = section.id
        }
      }
      setActiveId(current)
    }

    onScroll()
    window.addEventListener("scroll", onScroll, { passive: true })
    return () => window.removeEventListener("scroll", onScroll)
  }, [sections])

  return (
    <nav
      aria-label="On this page"
      className="h-fit w-full shrink-0 lg:sticky lg:top-14 lg:w-52"
    >
      <p className="mb-3 text-xs font-medium text-muted-foreground">On this page</p>
      <ol className="border-l border-border">
        {sections.map((section) => {
          const active = section.id === activeId
          return (
            <li key={section.id}>
              <a
                href={`#${section.id}`}
                aria-current={active ? "location" : undefined}
                className={cn(
                  "-ml-px block border-l py-1.5 pl-3 text-sm outline-none transition-colors focus-visible:text-foreground",
                  active
                    ? "border-foreground font-medium text-foreground"
                    : "border-transparent text-muted-foreground hover:text-foreground",
                )}
              >
                {section.title}
              </a>
            </li>
          )
        })}
      </ol>
    </nav>
  )
}
