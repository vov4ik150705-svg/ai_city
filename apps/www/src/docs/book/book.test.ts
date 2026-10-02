import { describe, expect, it } from "vitest"
import { resolveHref } from "../md/chapter"
import { chapterHref, chapterSlugOf, INDEX_CHAPTER } from "../paths"
import { chapters } from "../source"
import { bookFacts } from "./facts"
import { artPlacement, BOOK_ART_SLOT, bookPages } from "./pages"
import { swipeDecision } from "./useArtSwipe"

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

  it("parks every picture on one baseline and one horizontal centre", () => {
    const pages = bookPages(bookFacts())
    const bottoms: number[] = []
    const centres: number[] = []
    for (const page of pages) {
      expect(page.inkX).toBeGreaterThanOrEqual(0)
      expect(page.inkY).toBeGreaterThanOrEqual(0)
      expect(page.inkX + page.inkW).toBeLessThanOrEqual(page.width)
      expect(page.inkY + page.inkH).toBeLessThanOrEqual(page.height)
      const place = artPlacement(page)
      const imgLeft = (place.left / 100) * BOOK_ART_SLOT.w
      const imgTop = (place.top / 100) * BOOK_ART_SLOT.h
      const imgW = (place.width / 100) * BOOK_ART_SLOT.w
      const imgH = (place.height / 100) * BOOK_ART_SLOT.h
      const scaleX = imgW / page.width
      const scaleY = imgH / page.height
      expect(scaleX).toBeCloseTo(scaleY, 6)
      const inkLeft = imgLeft + page.inkX * scaleX
      const inkTop = imgTop + page.inkY * scaleY
      const inkRight = inkLeft + page.inkW * scaleX
      const inkBottom = inkTop + page.inkH * scaleY
      expect(inkLeft).toBeGreaterThanOrEqual(-0.01)
      expect(inkTop).toBeGreaterThanOrEqual(-0.01)
      expect(inkRight).toBeLessThanOrEqual(BOOK_ART_SLOT.w + 0.01)
      expect(inkBottom).toBeCloseTo(BOOK_ART_SLOT.h, 4)
      expect((inkLeft + inkRight) / 2).toBeCloseTo(BOOK_ART_SLOT.w / 2, 4)
      bottoms.push(inkBottom)
      centres.push((inkLeft + inkRight) / 2)
    }
    const baseline = bottoms[0]
    const centre = centres[0]
    if (baseline === undefined || centre === undefined) throw new Error("book: no pages")
    for (const bottom of bottoms) expect(bottom).toBeCloseTo(baseline, 4)
    for (const value of centres) expect(value).toBeCloseTo(centre, 4)
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

  it("turns a picture swipe into the neighbour page, and nothing past the ends", () => {
    const width = 390
    expect(swipeDecision(-20, 0, width, true, true)).toBe(0)
    expect(swipeDecision(-86, 0, width, true, true)).toBe(1)
    expect(swipeDecision(-8, -0.5, width, true, true)).toBe(1)
    expect(swipeDecision(86, 0, width, true, true)).toBe(-1)
    expect(swipeDecision(8, 0.5, width, true, true)).toBe(-1)
    expect(swipeDecision(-120, -1, width, true, false)).toBe(0)
    expect(swipeDecision(120, 1, width, false, true)).toBe(0)
    expect(swipeDecision(-80, 2, width, true, true)).toBe(0)
    expect(swipeDecision(-90, 2, width, true, true)).toBe(1)
    expect(swipeDecision(Number.NaN, 0, width, true, true)).toBe(0)
    expect(swipeDecision(-80, 0, 0, true, true)).toBe(0)
  })
})
