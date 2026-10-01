export const prizeFunnelCopy = {
  eyebrow: "Rating vs prizes",
  title: "From the Rating to a paid place",
  lead: "Your place on the Rating can differ from your prize place. Each step below removes cities that don't make it.",
  note: "Illustration. Dots are cities, not live data.",
} as const

export const prizeFunnelSteps = [
  {
    id: "listed",
    label: "Rating",
    title: "Every wallet city",
    text: "Ranked by Influence, one row per wallet.",
    dots: 30,
  },
  {
    id: "qualified",
    label: "At settlement",
    title: "Qualified",
    text: "At least 6 positive days in the period and a live stake. Without both, a city can't take a slot, whatever its Influence.",
    dots: 18,
  },
  {
    id: "slot",
    label: "One slot per wallet",
    title: "Best qualified city",
    text: "A wallet's best qualified city takes its slot. Ties go to the lower city ID.",
    dots: 13,
  },
  {
    id: "paid",
    label: "Leaderboard",
    title: "Top 10 are paid",
    text: "They split the Monthly pool in Stock Tokens. With fewer qualified, only real places split it.",
    dots: 10,
  },
] as const

export type PrizeFunnelStepId = (typeof prizeFunnelSteps)[number]["id"]
