import { chapterHref } from "../docs/paths"

function section(slug: string, hash = ""): string {
  const href = chapterHref(slug)
  return hash === "" ? href : `${href}#${hash}`
}

/** Site controls that open a handbook chapter. Each hash is a real heading id. */
export const docsLinks = {
  agents: section("agents"),
  economy: section("economy"),
  deposits: section("economy", "depositing"),
  payroll: section("economy", "payroll"),
  withdrawals: section("economy", "the-bank"),
  prizes: section("seasons"),
  industries: section("industries"),
  buildings: section("city", "directory"),
  firstSession: section("index", "your-first-session"),
  hud: section("index", "the-hud"),
  influence: section("seasons", "influence"),
  monthly: section("seasons", "monthly-prizes"),
  gettingStarted: section("index"),
} as const
