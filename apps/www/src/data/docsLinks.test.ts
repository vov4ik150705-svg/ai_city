import { describe, expect, it } from "vitest"
import { chapterSlugOf } from "../docs/paths"
import { chapters } from "../docs/source"
import { docsLinks } from "./docsLinks"

describe("site links into the handbook", () => {
  it("lands every control on a chapter, and every hash on a heading", () => {
    for (const href of Object.values(docsLinks)) {
      const [path, hash = ""] = href.split("#")
      const slug = chapterSlugOf(path ?? "")
      expect(slug, href).not.toBeNull()
      const chapter = chapters.find((item) => item.slug === slug)
      expect(chapter, href).toBeDefined()
      if (chapter === undefined || hash === "") continue
      expect(chapter.headings.some((heading) => heading.id === hash), href).toBe(true)
    }
  })

  it("rejects a hash that is not a heading", () => {
    const economy = chapters.find((item) => item.slug === "economy")
    expect(economy).toBeDefined()
    expect(economy?.headings.some((heading) => heading.id === "not-a-section")).toBe(false)
  })
})
