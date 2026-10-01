import type { StateLayout } from "../stateLayout"

/**
 * city.md, "Building states": what the card does to a building. Frozen stays in the table: it is a district
 * rule, and its way back is written in Industries, not in this section.
 */
export const cityBuildingStates: StateLayout = {
  width: 1160,
  height: 380,
  states: {
    CLOSED: { x: 190, y: 150, title: "Closed", sub: { text: "On the island, not yet part of your economy", face: "note" } },
    OPENING: { x: 560, y: 150, title: "Opening", sub: { text: "IDLE_UNDER_CONSTRUCTION", face: "mono" } },
    ACTIVE: { x: 900, y: 150, title: "Active", sub: { text: "Open and switched on", face: "note" } },
    DEACTIVATED: { x: 900, y: 330, title: "Deactivated", sub: { text: "Switched off by you", face: "note" } },
  },
  transitions: [
    {
      from: "CLOSED",
      to: "OPENING",
      points: [{ x: 352, y: 145 }, { x: 462, y: 145 }],
      label: { x: 407, y: 86, anchor: "middle" },
      lines: ["Open", "pays the level-1 price", "needs a free building slot"],
    },
    {
      from: "OPENING",
      to: "ACTIVE",
      points: [{ x: 658, y: 145 }, { x: 822, y: 145 }],
      label: { x: 740, y: 130, anchor: "middle" },
      lines: ["the timer ends"],
    },
    {
      from: "ACTIVE",
      to: "ACTIVE",
      points: [{ x: 872, y: 128 }, { x: 858, y: 88 }, { x: 942, y: 88 }, { x: 928, y: 128 }],
      label: { x: 846, y: 50, anchor: "end" },
      lines: ["Upgrade", "starts a new timer", "doesn't work until the timer ends"],
    },
    {
      from: "ACTIVE",
      to: "DEACTIVATED",
      points: [{ x: 880, y: 185 }, { x: 876, y: 247 }, { x: 880, y: 308 }],
      label: { x: 862, y: 240, anchor: "end" },
      lines: ["Deactivate", "keeps its level and its slot"],
    },
    {
      from: "DEACTIVATED",
      to: "ACTIVE",
      points: [{ x: 920, y: 308 }, { x: 924, y: 247 }, { x: 920, y: 185 }],
      label: { x: 938, y: 240, anchor: "start" },
      lines: ["Activate", "switches it back on for free"],
    },
  ],
  notes: [],
}
