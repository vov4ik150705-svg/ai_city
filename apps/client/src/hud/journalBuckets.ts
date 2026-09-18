export type JournalBucket = "idle" | "transport" | "other"

/** Transport failures stay out of idle reasons. */
export function journalBucket(key: string): JournalBucket {
  if (key.startsWith("IDLE_")) return "idle"
  if (key.startsWith("API_") || key.startsWith("SERVICE_")) return "transport"
  return "other"
}

export function journalMatchesBucket(key: string, bucket: "all" | JournalBucket): boolean {
  if (bucket === "all") return true
  return journalBucket(key) === bucket
}

export function journalBucketTitleKey(bucket: JournalBucket): string {
  switch (bucket) {
    case "idle":
      return "UI_JOURNAL_IDLE"
    case "transport":
      return "UI_JOURNAL_TRANSPORT"
    case "other":
      return "UI_LOG"
  }
}
