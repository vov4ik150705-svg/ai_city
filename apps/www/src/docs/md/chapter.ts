import { chapterHref } from "../paths"
import { parseBlocks } from "./blocks"
import { parseFrontMatter } from "./frontmatter"
import { createSlugger } from "./slug"
import type { Block, HeadingDepth, Inline, Issue } from "./types"

export type Heading = { readonly depth: HeadingDepth; readonly id: string; readonly text: string }

export type Chapter = {
  readonly slug: string
  readonly title: string
  readonly description: string
  readonly position: number
  readonly blocks: readonly Block[]
  readonly headings: readonly Heading[]
  readonly issues: readonly Issue[]
}

export type LinkTarget =
  | { readonly kind: "internal"; readonly slug: string; readonly hash: string; readonly href: string }
  | { readonly kind: "external"; readonly href: string }
  | { readonly kind: "unknown"; readonly href: string }

export function resolveHref(href: string, from: string): LinkTarget {
  if (/^https?:\/\//.test(href)) return { kind: "external", href }
  if (href.startsWith("#")) {
    const hash = href.slice(1)
    return { kind: "internal", slug: from, hash, href: `${chapterHref(from)}#${hash}` }
  }
  const match = /^([a-z0-9-]+)\.md(?:#([\w-]+))?$/.exec(href)
  if (match === null) return { kind: "unknown", href }
  const slug = match[1] ?? ""
  const hash = match[2] ?? ""
  return { kind: "internal", slug, hash, href: hash === "" ? chapterHref(slug) : `${chapterHref(slug)}#${hash}` }
}

function* inlineLinks(nodes: readonly Inline[]): Generator<string> {
  for (const node of nodes) {
    if (node.kind === "link") {
      yield node.href
      yield* inlineLinks(node.children)
    } else if (node.kind === "strong") {
      yield* inlineLinks(node.children)
    }
  }
}

export function* blockLinks(blocks: readonly Block[]): Generator<string> {
  for (const block of blocks) {
    switch (block.kind) {
      case "heading":
      case "paragraph":
        yield* inlineLinks(block.children)
        break
      case "list":
        for (const item of block.items) yield* inlineLinks(item)
        break
      case "table":
        for (const cell of block.head) yield* inlineLinks(cell)
        for (const row of block.rows) for (const cell of row) yield* inlineLinks(cell)
        break
      case "quote":
        yield* blockLinks(block.children)
        break
      case "math":
      case "code":
        break
      default: {
        const never: never = block
        throw new Error(`unknown block ${String(never)}`)
      }
    }
  }
}

export function parseChapter(slug: string, raw: string): Chapter {
  const lines = raw.replace(/\r\n?/g, "\n").split("\n")
  const issues: Issue[] = []
  const issue = (line: number, message: string) => issues.push({ line, message })
  const front = parseFrontMatter(lines, issue)

  const title = front.fields.get("title") ?? ""
  const description = front.fields.get("description") ?? ""
  const position = Number(front.fields.get("sidebar_position") ?? "")
  if (title === "") issue(1, "front matter has no title")
  if (description === "") issue(1, "front matter has no description")
  if (!Number.isInteger(position)) issue(1, "front matter has no integer sidebar_position")

  const blocks = parseBlocks({
    lines: lines.slice(front.bodyStart),
    offset: front.bodyStart,
    issue,
    slug: createSlugger(),
  })

  const headings: Heading[] = []
  for (const block of blocks) {
    if (block.kind === "heading") headings.push({ depth: block.depth, id: block.id, text: block.text })
  }
  const first = blocks[0]
  if (first?.kind !== "heading" || first.depth !== 1) issue(front.bodyStart + 1, "a chapter starts with its # title")
  else if (first.text !== title) issue(front.bodyStart + 1, `# title "${first.text}" differs from front matter "${title}"`)
  if (headings.filter((h) => h.depth === 1).length > 1) issue(front.bodyStart + 1, "a chapter has one # title")

  return { slug, title, description, position, blocks, headings, issues }
}

/** Problems that need every chapter at once: positions and cross-chapter links. */
export function crossCheck(chapters: readonly Chapter[]): readonly string[] {
  const problems: string[] = []
  const bySlug = new Map(chapters.map((chapter) => [chapter.slug, chapter]))
  const positions = chapters.map((chapter) => chapter.position).sort((a, b) => a - b)
  positions.forEach((position, index) => {
    if (position !== index + 1) problems.push(`sidebar_position ${position} breaks the 1..${chapters.length} order`)
  })
  for (const chapter of chapters) {
    for (const href of blockLinks(chapter.blocks)) {
      const target = resolveHref(href, chapter.slug)
      if (target.kind === "unknown") {
        problems.push(`${chapter.slug}: link ${href} is neither a chapter nor an external URL`)
        continue
      }
      if (target.kind === "external") continue
      const to = bySlug.get(target.slug)
      if (to === undefined) problems.push(`${chapter.slug}: link ${href} names a missing chapter`)
      else if (target.hash !== "" && !to.headings.some((h) => h.id === target.hash)) {
        problems.push(`${chapter.slug}: link ${href} names a missing section`)
      }
    }
  }
  return problems
}
