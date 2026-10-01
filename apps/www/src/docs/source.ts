import { crossCheck, parseChapter, type Chapter } from "./md/chapter"

const files = import.meta.glob<string>("../../../../docs/public/*.md", {
  query: "?raw",
  import: "default",
  eager: true,
})

function slugOfFile(path: string): string {
  const name = path.split("/").pop() ?? path
  return name.replace(/\.md$/, "")
}

export const chapters: readonly Chapter[] = Object.entries(files)
  .map(([path, raw]) => parseChapter(slugOfFile(path), raw))
  .sort((a, b) => a.position - b.position)

export const sourceProblems: readonly string[] = [
  ...chapters.flatMap((chapter) => chapter.issues.map((issue) => `${chapter.slug}.md:${issue.line} ${issue.message}`)),
  ...crossCheck(chapters),
]

export function chapterBySlug(slug: string): Chapter | undefined {
  return chapters.find((chapter) => chapter.slug === slug)
}

export function chapterNumber(chapter: Chapter): string {
  return String(chapter.position).padStart(2, "0")
}
