export const cityDayRealHours = 25
export const cityDayHours = 24

export const clockCopy = {
  eyebrow: "Calendar",
  title: "One calendar for everyone",
  lead: "Rewards run on one global calendar. The bars below are drawn to scale against a 90-day season.",
  axis: "City days",
  oneDay: "{hours} real hours",
  span: "{days} city days · {hours} real hours",
  dayTitle: "Inside one city day",
  dayLead: "A city day lasts {hours} real hours, split into {ticks} ticks.",
  marks: [
    { id: "score", hour: 0, label: "00:00", text: "The day's score is added to Influence." },
    { id: "settle", hour: 6, label: "06:00", text: "On the first day of a new window or period, the old one settles." },
  ],
} as const

export const clockCells = [
  {
    id: "city-day",
    label: "City day",
    days: 1,
    text: "One scored day.",
  },
  {
    id: "farm",
    label: "Farm window",
    days: 7,
    text: "How long you earn Farm fragments.",
  },
  {
    id: "prize",
    label: "Prize period",
    days: 30,
    text: "Influence and the Monthly prize.",
  },
  {
    id: "season",
    label: "Season",
    days: 90,
    text: "Three prize periods. A calendar label. It pays nothing on its own.",
  },
] as const

export type ClockCellId = (typeof clockCells)[number]["id"]

export const clockFootnote =
  "A new city joins the current period and counts from its creation. Earlier days are not backfilled."
