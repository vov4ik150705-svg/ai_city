import type { FlowLayout } from "../flowLayout"

/** economy.md, "How value moves". The spine is wallet ↔ vault ↔ Capital; Studio sits under the lane separator, in neither group. */
export const economyValueFlow: FlowLayout = {
  width: 1160,
  height: 680,
  lanes: [
    { group: "chain", x: 40, y: 50 },
    { group: "game", x: 700, y: 50 },
  ],
  dividers: [{ from: { x: 635, y: 24 }, to: { x: 635, y: 596 } }],
  nodes: {
    W: { x: 40, y: 110, w: 190, h: 62 },
    V: { x: 380, y: 110, w: 190, h: 62 },
    DEX: { x: 40, y: 300, w: 250, h: 62 },
    PT: { x: 40, y: 500, w: 210, h: 62 },
    CAP: { x: 700, y: 110, w: 200, h: 62 },
    BURN: { x: 1000, y: 111, w: 100, h: 60 },
    F: { x: 700, y: 300, w: 180, h: 62 },
    R: { x: 1000, y: 300, w: 140, h: 62 },
    ST: { x: 560, y: 620, w: 150, h: 48 },
  },
  edges: {
    "W>DEX": { points: [{ x: 190, y: 173 }, { x: 190, y: 299 }], label: { x: 200, y: 242, anchor: "start" } },
    "DEX>V": {
      points: [{ x: 291, y: 312 }, { x: 405, y: 262 }, { x: 440, y: 173 }],
      label: { x: 392, y: 232, anchor: "end" },
    },
    "DEX>PT": { points: [{ x: 120, y: 363 }, { x: 120, y: 499 }], label: { x: 132, y: 452, anchor: "start" } },
    "DEX>ST": {
      points: [{ x: 285, y: 363 }, { x: 420, y: 540 }, { x: 559, y: 644 }],
      label: { x: 462, y: 604, anchor: "end" },
    },
    "W>V": { points: [{ x: 231, y: 128 }, { x: 379, y: 128 }], label: { x: 305, y: 119, anchor: "middle" } },
    "V>CAP": { points: [{ x: 571, y: 128 }, { x: 699, y: 128 }], label: { x: 646, y: 119, anchor: "start" } },
    "V>F": {
      points: [{ x: 520, y: 173 }, { x: 562, y: 268 }, { x: 699, y: 331 }],
      label: { x: 574, y: 300, anchor: "end" },
    },
    "CAP>F": { points: [{ x: 770, y: 173 }, { x: 770, y: 299 }], label: { x: 760, y: 242, anchor: "end" } },
    "CAP>BURN": { points: [{ x: 901, y: 141 }, { x: 1001, y: 141 }], label: { x: 950, y: 132, anchor: "middle" } },
    "F>CAP": { points: [{ x: 825, y: 299 }, { x: 825, y: 173 }], label: { x: 835, y: 242, anchor: "start" } },
    "F>R": { points: [{ x: 881, y: 316 }, { x: 999, y: 316 }], label: { x: 940, y: 292, anchor: "middle" } },
    "R>F": { points: [{ x: 999, y: 346 }, { x: 881, y: 346 }], label: { x: 940, y: 386, anchor: "middle" } },
    "CAP>V": { points: [{ x: 699, y: 155 }, { x: 571, y: 155 }], label: { x: 640, y: 194, anchor: "middle" } },
    "V>W": { points: [{ x: 379, y: 155 }, { x: 231, y: 155 }], label: { x: 305, y: 178, anchor: "middle" } },
    "PT>W": {
      points: [{ x: 39, y: 526 }, { x: 16, y: 430 }, { x: 16, y: 240 }, { x: 39, y: 150 }],
      label: { x: 26, y: 245, anchor: "start" },
    },
  },
}
