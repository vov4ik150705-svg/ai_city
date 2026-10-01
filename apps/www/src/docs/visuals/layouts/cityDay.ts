import type { DayLayout } from "../dayLayout"

/** city.md, "City time": the four schedules on one city day, and the two moments that close and refresh it. */
export const cityDay: DayLayout = {
  hours: 24,
  rows: [
    { label: "always", from: 0, to: 24, note: "Production, Energy, Compute, logistics" },
    { label: "market", from: 8, to: 20, note: "Bank, Exchange" },
    { label: "retail", from: 9, to: 21, note: "Flagship Store, Retail Complex" },
    { label: "office", from: 8, to: 20, note: "City Hall, Agent Hub, Cloud Campus, Finance Tower, Clearing House" },
  ],
  marks: [
    { at: 0, lines: ["closes the day for Payroll,", "GDP and Influence, and fixes", "the next day's Payroll budget"] },
    { at: 6, lines: ["refreshes district efficiency", "and settles Farm windows,", "prize periods and seasons"] },
  ],
}
