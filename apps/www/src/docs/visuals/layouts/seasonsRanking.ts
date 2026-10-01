import type { StateLayout } from "../stateLayout"

/**
 * seasons.md, "Ranking and prize rank": one wallet city, two orders. The public ranking takes every wallet city;
 * prize rank takes only qualified ones, one slot per wallet. Which refusal code names which missing condition is
 * not said, so the codes stay in the prose.
 */
export const seasonsRanking: StateLayout = {
  width: 1160,
  height: 390,
  states: {
    CITY: { x: 150, y: 190, title: "Wallet city" },
    RANKING: { x: 900, y: 80, title: "Ranking", sub: { text: "is public", face: "note" } },
    QUALIFIED: { x: 640, y: 300, title: "Qualified" },
    PRIZE: { x: 970, y: 300, title: "Prize rank" },
  },
  transitions: [
    {
      from: "CITY",
      to: "RANKING",
      points: [{ x: 224, y: 178 }, { x: 480, y: 100 }, { x: 850, y: 80 }],
      label: { x: 500, y: 58, anchor: "middle" },
      lines: ["Sorted by Influence,", "highest first"],
    },
    {
      from: "CITY",
      to: "QUALIFIED",
      points: [{ x: 224, y: 202 }, { x: 420, y: 300 }, { x: 578, y: 300 }],
      label: { x: 480, y: 334, anchor: "middle" },
      lines: ["at least 6 positive days", "in the 30-day period, and", "a live stake in a district"],
    },
    {
      from: "QUALIFIED",
      to: "PRIZE",
      points: [{ x: 702, y: 295 }, { x: 902, y: 295 }],
      label: { x: 802, y: 334, anchor: "middle" },
      lines: ["one slot per wallet,", "taken by the wallet's", "best qualified city"],
    },
  ],
  notes: [{ spot: { x: 935, y: 190, anchor: "middle" }, lines: ["your place on the public ranking", "can differ from your prize rank"] }],
}
