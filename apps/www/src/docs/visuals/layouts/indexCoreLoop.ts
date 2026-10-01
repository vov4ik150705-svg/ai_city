import type { FlowLayout } from "../flowLayout"

/** index.md, "The core loop". The ring runs clockwise from Capital back to Capital; the two exits hang below it. */
export const indexCoreLoop: FlowLayout = {
  width: 1160,
  height: 560,
  lanes: [],
  dividers: [],
  nodes: {
    D: { x: 20, y: 120, w: 190, h: 56 },
    C: { x: 270, y: 120, w: 140, h: 56 },
    B: { x: 480, y: 30, w: 230, h: 72, phrase: true },
    H: { x: 480, y: 194, w: 230, h: 56 },
    S: { x: 790, y: 120, w: 180, h: 56 },
    T: { x: 700, y: 330, w: 300, h: 72 },
    P: { x: 330, y: 330, w: 230, h: 72, phrase: true },
    W: { x: 20, y: 250, w: 270, h: 56 },
    X: { x: 100, y: 390, w: 110, h: 56 },
    I: { x: 700, y: 480, w: 300, h: 56 },
    R: { x: 360, y: 480, w: 250, h: 56 },
  },
  edges: {
    "D>C": { points: [{ x: 211, y: 148 }, { x: 269, y: 148 }] },
    "C>B": { points: [{ x: 411, y: 134 }, { x: 440, y: 86 }, { x: 479, y: 70 }] },
    "C>H": { points: [{ x: 411, y: 162 }, { x: 440, y: 206 }, { x: 479, y: 220 }] },
    "B>S": { points: [{ x: 711, y: 70 }, { x: 760, y: 86 }, { x: 815, y: 119 }] },
    "H>S": { points: [{ x: 711, y: 220 }, { x: 760, y: 206 }, { x: 815, y: 177 }] },
    "S>T": { points: [{ x: 890, y: 177 }, { x: 890, y: 329 }] },
    "T>P": { points: [{ x: 699, y: 366 }, { x: 561, y: 366 }] },
    "P>C": { points: [{ x: 400, y: 329 }, { x: 385, y: 250 }, { x: 370, y: 177 }] },
    "C>W": { points: [{ x: 290, y: 177 }, { x: 250, y: 215 }, { x: 205, y: 249 }] },
    "W>X": { points: [{ x: 155, y: 307 }, { x: 155, y: 389 }] },
    "T>I": { points: [{ x: 850, y: 403 }, { x: 850, y: 479 }] },
    "I>R": { points: [{ x: 699, y: 508 }, { x: 611, y: 508 }] },
  },
}
