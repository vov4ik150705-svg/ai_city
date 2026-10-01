import { describe, expect, it } from "vitest"
import { resolveHref } from "../md/chapter"
import { chapterHref, chapterSlugOf, INDEX_CHAPTER } from "../paths"
import { chapters } from "../source"
import { bookFacts } from "./facts"
import { bookPages } from "./pages"

describe("how the island works", () => {
  it("reads the pack numbers the pictures were drawn with", () => {
    expect(bookFacts()).toEqual({
      neighbourPct: 60,
      offlineHours: 12,
      boostLaunch: 8,
      boostLaunchDays: 7,
      boost: 3,
      roundTripPct: "14.45",
      unstakeDays: 30,
    })
  })

  it("opens the book at /docs and Getting Started at its own address", () => {
    expect(chapterSlugOf("/docs")).toBeNull()
    expect(chapterSlugOf("/docs/getting-started")).toBe(INDEX_CHAPTER)
    expect(chapterSlugOf("/docs/economy")).toBe("economy")
    expect(chapterHref(INDEX_CHAPTER)).toBe("/docs/getting-started")
    expect(chapterHref("economy")).toBe("/docs/economy")
  })

  it("sends every picture bridge to a real handbook heading", () => {
    for (const page of bookPages(bookFacts())) {
      const target = resolveHref(page.ref, INDEX_CHAPTER)
      expect(target.kind).toBe("internal")
      if (target.kind !== "internal") continue
      const chapter = chapters.find((item) => item.slug === target.slug)
      expect(chapter, page.ref).toBeDefined()
      if (chapter === undefined || target.hash === "") continue
      expect(chapter.headings.some((heading) => heading.id === target.hash), page.ref).toBe(true)
    }
  })
})
