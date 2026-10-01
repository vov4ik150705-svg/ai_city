// Single source of geometry for the quick guide page.
// Canvas numbers are pixels of the approved 1672 x 941 mockup
// (hud/quick-guide-reference/00-approved-mockup.png); the whole canvas scales as one.
// Mark numbers are pixels of the island art itself (01-welcome-island-white-v1.png,
// 1672 x 941), so the overlay stays on its buildings wherever the art is placed.

export type Pt = readonly [number, number]

export const CANVAS = { w: 1672, h: 941 } as const

export const ART = {
  naturalW: 1672,
  naturalH: 941,
  // Placement of the welcome art inside the panel stage, fitted against the mockup.
  scale: 0.849,
  left: 34,
  top: 12,
} as const

export interface Badge {
  readonly label: string
  readonly at: Pt
  readonly r: number
}

export interface LabelLine {
  readonly text: string
  readonly at: Pt
  readonly rotate: number
}

export interface Stroke {
  readonly dashed: boolean
  readonly points: readonly Pt[]
  // Arrowhead drawn as arm -> tip -> arm; null for a plain stroke.
  readonly head: readonly [Pt, Pt, Pt] | null
}

export interface Clock {
  readonly at: Pt
  readonly r: number
  readonly hands: readonly Pt[]
  readonly rays: readonly (readonly [Pt, Pt])[]
}

export interface Marks {
  readonly badges: readonly Badge[]
  readonly labels: readonly LabelLine[]
  readonly strokes: readonly Stroke[]
  readonly clock: Clock | null
}

// Pen sizes in art pixels.
export const PEN = {
  solid: 4.8,
  dashed: 6.6,
  dash: 18,
  gap: 10,
  head: 5.2,
  ring: 4.4,
  tick: 2.8,
  hand: 4.2,
  ray: 4.4,
  halo: 5,
  labelSize: 44,
  labelWeight: 1.1,
  labelHalo: 8,
  badgeSize: 58,
  // Degrees of lean for handwritten type; Caveat itself stands almost upright.
  slant: -8,
} as const

export const WELCOME_MARKS: Marks = {
  badges: [
    { label: "1", at: [304, 423], r: 23 },
    { label: "2", at: [1117, 823], r: 26 },
    { label: "3", at: [793, 534], r: 23.6 },
    { label: "4", at: [1447, 107], r: 24.7 },
  ],
  labels: [
    { text: "start", at: [286, 496], rotate: -9 },
    { text: "here", at: [290, 518], rotate: -9 },
    { text: "hire", at: [839, 575], rotate: -7 },
    { text: "people", at: [868, 600], rotate: -7 },
    { text: "switch them on", at: [1279, 816], rotate: -6 },
    { text: "wait for", at: [1504, 152], rotate: -9 },
    { text: "the hour", at: [1515, 188], rotate: -7 },
  ],
  strokes: [
    {
      dashed: false,
      points: [[337, 428], [372, 420], [396, 437], [410, 458], [424, 481], [437, 503], [457, 511]],
      head: [[444, 499], [460, 512], [446, 520]],
    },
    {
      dashed: false,
      points: [[799, 563], [797, 580], [786, 591], [765, 595]],
      head: [[774, 584], [761, 595], [775, 601]],
    },
    {
      dashed: true,
      points: [[684, 585], [643, 589], [608, 584], [584, 572], [572, 564], [556, 549]],
      head: [[571, 548], [554, 546], [561, 562]],
    },
    {
      dashed: true,
      points: [[869, 556], [902, 551], [943, 552], [959, 576], [969, 596], [959, 631], [947, 659]],
      head: null,
    },
    {
      dashed: true,
      points: [[820, 627], [861, 622], [908, 637], [943, 659]],
      head: [[938, 650], [946, 664], [958, 651]],
    },
    {
      dashed: true,
      points: [[1085, 822], [1044, 821], [1008, 814], [994, 799], [987, 790], [985, 778]],
      head: [[978, 788], [985, 776], [994, 786]],
    },
    {
      dashed: true,
      points: [[1159, 820], [1191, 802], [1212, 784], [1216, 750]],
      head: [[1210, 753], [1218, 736], [1229, 753]],
    },
    {
      dashed: true,
      points: [
        [1366, 487], [1397, 443], [1421, 390], [1441, 331], [1445, 284], [1441, 249], [1421, 219], [1397, 199], [1378, 184],
      ],
      head: [[1379, 198], [1375, 181], [1392, 184]],
    },
  ],
  clock: {
    at: [1344, 146],
    r: 30.6,
    hands: [[1343, 125], [1356, 157]],
    rays: [
      [[1293, 104], [1304, 111]],
      [[1285, 131], [1296, 132]],
      [[1286, 168], [1297, 163]],
      [[1368, 104], [1378, 91]],
      [[1386, 124], [1404, 114]],
      [[1393, 143], [1421, 132]],
    ],
  },
}

export interface Step {
  readonly eyebrow: string
  readonly title: string
  readonly lede: string
  readonly marks: Marks | null
  // Ready plates use one transparent PNG. Every other page keeps the welcome island.
  readonly scene: "welcome" | "bank" | "workshop" | "people" | "to-work" | "first-shift" | "screen" | "whats-next"
  readonly footnote: string
}

// Copy of steps 2-8 is only a placeholder until their pages are drawn;
// eyebrows and titles follow docs/reports/QUICK_GUIDE_CONCEPT.md §3.
export const STEPS: readonly Step[] = [
  {
    eyebrow: "01 — WELCOME",
    title: "This island is yours",
    // Line breaks follow the mockup; the page renders them with white-space: pre-line.
    lede: "All the buildings are already here. You open them,\nhire people and keep the work going. Here's how\nyour first hour goes.",
    marks: null,
    scene: "welcome",
    footnote: "",
  },
  {
    eyebrow: "02 — THE BANK",
    title: "First stop: the Bank",
    lede: "Everything in the city is paid for in Capital, and this is where you get it. Bring in $CORP from your wallet — the Bank turns it into Capital.",
    marks: null,
    scene: "bank",
    footnote: "Nothing leaves your wallet until you confirm. No $CORP yet? It's bought with ETH, outside the game.",
  },
  {
    eyebrow: "03 — FIRST BUILDINGS",
    title: "The Workshop comes first",
    lede: "The Workshop is where your Capital gets made.\nIt needs electricity, so open the Power Node next to it too.",
    marks: null,
    scene: "workshop",
    footnote: "You never build anything here. Every building is already standing — you just switch it on.",
  },
  {
    eyebrow: "04 — PEOPLE",
    title: "Buildings need people",
    lede: "An open building does nothing on its own. Hire two Engineers — they're the ones who run the Workshop and the Power Node.",
    marks: null,
    scene: "people",
    footnote: "No AI inside. Your people follow the city's rules, the same way every time.",
  },
  {
    eyebrow: "05 — TO WORK",
    title: "Give everyone a seat",
    lede: "Tell each Engineer where to work: one to the Workshop, one to the Power Node.\nThey start on the next hour.",
    marks: null,
    scene: "to-work",
    footnote: "",
  },
  {
    eyebrow: "06 — THE FIRST SHIFT",
    title: "Now wait for the hour",
    lede: "Once every city hour, your people work a shift and the city pays them in Capital. The clock at the top shows city time — an hour there is about an hour here.",
    marks: null,
    scene: "first-shift",
    footnote: "Leave the game and your city keeps working for up to {offline_hours} hours.",
  },
  {
    eyebrow: "07 — THE SCREEN",
    title: "Keep an eye on these",
    lede: "The island always stays in the middle.\nAround it, the city tells you how it's doing.",
    marks: null,
    scene: "screen",
    footnote: "",
  },
  {
    eyebrow: "08 — WHAT'S NEXT",
    title: "That's the whole start",
    lede: "Your city is working. When you want more, here are three roads.",
    marks: null,
    scene: "whats-next",
    footnote: "If a button won't press, it tells you why.",
  },
]
