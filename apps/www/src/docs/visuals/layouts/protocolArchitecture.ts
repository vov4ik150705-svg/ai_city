import type { FlowLayout } from "../flowLayout"

/**
 * protocol.md, "Architecture": three bands, top to bottom. The attestor's arrow enters MerkleRoots right of the
 * chain band's label, so the label stays clear. The one crossing (wallet to PrizeTreasury over API to Vault) is the
 * least a two-band drawing allows when both the wallet and the API reach both contracts.
 */
export const protocolArchitecture: FlowLayout = {
  width: 1160,
  height: 700,
  lanes: [
    { group: "browser", x: 30, y: 50 },
    { group: "server", x: 30, y: 215 },
    { group: "chain", x: 30, y: 595 },
  ],
  dividers: [
    { from: { x: 20, y: 180 }, to: { x: 1140, y: 180 } },
    { from: { x: 20, y: 560 }, to: { x: 1140, y: 560 } },
  ],
  nodes: {
    HUD: { x: 325, y: 80, w: 230, h: 60 },
    WAL: { x: 820, y: 80, w: 180, h: 60 },
    API: { x: 300, y: 240, w: 280, h: 86, caption: true },
    SMP: { x: 40, y: 240, w: 230, h: 66, caption: true },
    ENG: { x: 40, y: 355, w: 230, h: 66, caption: true },
    ATT: { x: 40, y: 470, w: 230, h: 66, caption: true },
    MR: { x: 200, y: 615, w: 170, h: 60 },
    PT: { x: 395, y: 615, w: 190, h: 60 },
    V: { x: 610, y: 615, w: 110, h: 60 },
    SR: { x: 745, y: 615, w: 180, h: 60 },
    DEX: { x: 950, y: 615, w: 180, h: 60 },
  },
  edges: {
    "HUD>API": { points: [{ x: 440, y: 141 }, { x: 440, y: 239 }] },
    "WAL>V": { points: [{ x: 860, y: 141 }, { x: 690, y: 614 }] },
    "WAL>SR": { points: [{ x: 900, y: 141 }, { x: 835, y: 614 }] },
    "WAL>PT": { points: [{ x: 840, y: 141 }, { x: 560, y: 614 }] },
    "WAL>DEX": { points: [{ x: 960, y: 141 }, { x: 1040, y: 614 }] },
    "API>ENG": { points: [{ x: 299, y: 310 }, { x: 271, y: 380 }] },
    "SMP>ENG": { points: [{ x: 155, y: 307 }, { x: 155, y: 354 }] },
    "ENG>ATT": { points: [{ x: 155, y: 422 }, { x: 155, y: 469 }] },
    "ATT>MR": { points: [{ x: 262, y: 537 }, { x: 300, y: 614 }] },
    "API>V": { points: [{ x: 550, y: 327 }, { x: 650, y: 614 }] },
    "API>PT": { points: [{ x: 420, y: 327 }, { x: 470, y: 614 }] },
  },
}
