export const DOCS_ROOT = "/docs"
export const INDEX_CHAPTER = "index"

export function isDocsPath(path: string): boolean {
  return path === DOCS_ROOT || path.startsWith(`${DOCS_ROOT}/`)
}

export function chapterSlugOf(path: string): string | null {
  if (path === DOCS_ROOT) return null
  const match = /^\/docs\/([a-z0-9-]+)$/.exec(path)
  const slug = match?.[1]
  if (slug === undefined) return null
  if (slug === "getting-started" || slug === INDEX_CHAPTER) return INDEX_CHAPTER
  return slug
}

export function chapterHref(slug: string): string {
  return slug === INDEX_CHAPTER ? `${DOCS_ROOT}/getting-started` : `${DOCS_ROOT}/${slug}`
}
