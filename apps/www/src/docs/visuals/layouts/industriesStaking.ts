import type { StateLayout } from "../stateLayout"

/**
 * industries.md, "Staking": the Mermaid state chart, drawn. Every arrow reads back as its chart label; the codes
 * under Grace and Frozen come from the section's own list.
 */
export const industriesStaking: StateLayout = {
  width: 1160,
  height: 380,
  start: { state: "Closed", points: [{ x: 60, y: 115 }, { x: 156, y: 115 }] },
  states: {
    Closed: { x: 200, y: 120, title: "Closed" },
    Open: { x: 620, y: 120, title: "Open" },
    Grace: { x: 620, y: 330, title: "Grace", sub: { text: "DISTRICT_FREEZING", face: "mono" } },
    Frozen: { x: 1000, y: 330, title: "Frozen", sub: { text: "IDLE_DISTRICT_FROZEN", face: "mono" }, hard: true },
  },
  transitions: [
    {
      from: "Closed",
      to: "Open",
      points: [{ x: 244, y: 115 }, { x: 588, y: 115 }],
      label: { x: 416, y: 78, anchor: "middle" },
      lines: ["stake reaches S_min,", "opens at tier 1"],
    },
    {
      from: "Open",
      to: "Open",
      points: [{ x: 608, y: 97 }, { x: 596, y: 58 }, { x: 644, y: 58 }, { x: 632, y: 97 }],
      label: { x: 658, y: 66, anchor: "start" },
      lines: ["stake more for higher tiers"],
    },
    {
      from: "Open",
      to: "Grace",
      points: [{ x: 608, y: 132 }, { x: 603, y: 220 }, { x: 608, y: 307 }],
      label: { x: 590, y: 224, anchor: "end" },
      lines: ["unstake below S_min"],
    },
    {
      from: "Grace",
      to: "Open",
      points: [{ x: 636, y: 307 }, { x: 641, y: 220 }, { x: 636, y: 132 }],
      label: { x: 654, y: 216, anchor: "start" },
      lines: ["restake within", "24 city hours"],
    },
    {
      from: "Grace",
      to: "Frozen",
      points: [{ x: 696, y: 335 }, { x: 912, y: 335 }],
      label: { x: 804, y: 322, anchor: "middle" },
      lines: ["24 city hours pass"],
    },
    {
      from: "Frozen",
      to: "Open",
      points: [{ x: 1000, y: 307 }, { x: 992, y: 170 }, { x: 930, y: 122 }, { x: 652, y: 118 }],
      label: { x: 1012, y: 202, anchor: "start" },
      lines: ["restake to S_min", "or more"],
    },
  ],
  notes: [],
}
