import type { BookFacts } from "./facts"

export const BOOK_STORAGE_KEY = "corporator-book-anchor"

export type BookPage = {
  readonly n: number
  readonly anchor: string
  readonly dir: string
  readonly eyebrow: string
  readonly title: readonly string[]
  readonly intro: string
  readonly note: string
  readonly linkLabel: string
  readonly ref: string
  readonly alt: string
  readonly width: number
  readonly height: number
  readonly artLeft: number
  readonly artTop: number
  readonly artWidth: number
  readonly introTop: number
}

export function bookPages(facts: BookFacts): readonly BookPage[] {
  return [
    {
      n: 1,
      anchor: "island",
      dir: "01-island-ready",
      eyebrow: "01 — THE ISLAND",
      title: ["One island, many cities"],
      intro:
        "Everyone plays on the same island, and every building is already standing, asleep until you open it. What's different is the city behind it: who you hire, what you open and how well it runs.",
      note: "You never place or build anything. The map was drawn once, by hand.",
      linkLabel: "More in the handbook → Your City",
      ref: "city.md",
      alt: "A floating island city with only a few buildings lit, and two pencil outlines of the same island behind it, lit in different places.",
      width: 1602,
      height: 981,
      artLeft: 190,
      artTop: 0,
      artWidth: 1120,
      introTop: 211,
    },
    {
      n: 2,
      anchor: "people",
      dir: "02-people-ready",
      eyebrow: "02 — PEOPLE",
      title: ["Everyone has", "their own place"],
      intro: `You hire agents, and each has one of five jobs. In their own building an agent works at full strength, in a related one at ${facts.neighbourPct}%. Anywhere else, they just stand there.`,
      note: "No AI inside. Agents follow the same fixed rules, every time.",
      linkLabel: "More in the handbook → Roles",
      ref: "agents.md#roles",
      alt: "The same engineer in three doorways, working at full strength, at part strength and standing idle in a bank; five small portraits below.",
      width: 1672,
      height: 941,
      artLeft: 80,
      artTop: 0,
      artWidth: 1200,
      introTop: 270,
    },
    {
      n: 3,
      anchor: "shift",
      dir: "03-shift-ready",
      eyebrow: "03 — PEOPLE",
      title: ["Every hour, a shift"],
      intro:
        "Once every city hour the city takes stock. Everyone who worked hands in a pay slip. Everyone who couldn't leaves a note saying why.",
      note: `Offline, your city works for up to ${facts.offlineHours} hours. After that, hours are skipped, not saved.`,
      linkLabel: "More in the handbook → How a seat earns",
      ref: "agents.md#how-a-seat-earns",
      alt: "A clock strikes the hour; two engineers drop blue pay slips into a box while a third worker sticks a grey note on it.",
      width: 1672,
      height: 941,
      artLeft: 330,
      artTop: 70,
      artWidth: 960,
      introTop: 211,
    },
    {
      n: 4,
      anchor: "money",
      dir: "04-money-ready",
      eyebrow: "04 — MONEY",
      title: ["Three kinds of money"],
      intro:
        "$CORP lives in your wallet. Capital is the city's own money, and every chip has a $CORP coin behind it in the vault. Stock tokens are shares like NVDA that open districts.",
      note: "Capital isn't a token. You can't sell it or send it to a friend.",
      linkLabel: "More in the handbook → The backing rule",
      ref: "economy.md#the-backing-rule",
      alt: "A wallet with a coin, a stack of chips standing on a small safe with a thread from each chip to a coin, and a fan of six stock-token coins.",
      width: 1672,
      height: 941,
      artLeft: 220,
      artTop: 90,
      artWidth: 1040,
      introTop: 211,
    },
    {
      n: 5,
      anchor: "the-tank",
      dir: "05-the-tank-ready",
      eyebrow: "05 — MONEY",
      title: ["Everyone is paid", "from one tank"],
      intro:
        "Every city's people are paid from one shared fund, Payroll. Each hour it pours out a budget and splits it by what each seat asked for. A quiet hour means more for everyone, a busy one less.",
      note: `Early on the tank pours extra: up to ×${facts.boostLaunch} for the first ${facts.boostLaunchDays} city days, then up to ×${facts.boost}. Only while it holds enough.`,
      linkLabel: "More in the handbook → Payroll",
      ref: "economy.md#payroll",
      alt: "A water tower labelled Payroll feeds three islands; in a quiet hour three cups overflow, in a busy hour nine cups are equally half full.",
      width: 1672,
      height: 941,
      artLeft: 90,
      artTop: 0,
      artWidth: 1200,
      introTop: 270,
    },
    {
      n: 6,
      anchor: "fills",
      dir: "06-fills-ready",
      eyebrow: "06 — MONEY",
      title: ["What fills the tank"],
      intro:
        "Two streams. When anyone spends Capital, part of it burns and the rest flows back into the tank. And every $CORP trade leaves a small toll — half of it ends up here too.",
      note: "When the tank is over-full, the extra goes to a reserve and drips back slowly.",
      linkLabel: "More in the handbook → How value moves",
      ref: "economy.md#how-value-moves",
      alt: "Chips split between a small flame and a pipe into the tank; a toll gate under a trading pond drips into four pipes: the tank, a prize jar, a podium and a small studio house.",
      width: 1671,
      height: 941,
      artLeft: 90,
      artTop: 0,
      artWidth: 1200,
      introTop: 211,
    },
    {
      n: 7,
      anchor: "way-home",
      dir: "07-way-home-ready",
      eyebrow: "07 — MONEY",
      title: ["The way home"],
      intro:
        "Want your $CORP back? The Bank turns Capital into a ticket that's good for one city hour. Take it to your wallet in time, and the coins are yours.",
      note: `Coming in is always cheaper than going out: a full round trip costs about ${facts.roundTripPct}% in fees.`,
      linkLabel: "More in the handbook → The Bank",
      ref: "economy.md#the-bank",
      alt: "At a bank window chips turn into a ticket with an hourglass, and a hand carries it along a path to a wallet.",
      width: 1672,
      height: 941,
      artLeft: 90,
      artTop: 0,
      artWidth: 1200,
      introTop: 211,
    },
    {
      n: 8,
      anchor: "keys",
      dir: "08-keys-ready",
      eyebrow: "08 — DISTRICTS",
      title: ["Six districts, six keys"],
      intro:
        "The island has six districts, and each one has a key: a stock token. Stake NVDA, and Compute opens. TSLA opens Energy, and so on.",
      note: "Opening a district costs no Capital, only the stake. Demo cities can't open districts.",
      linkLabel: "More in the handbook → The six districts",
      ref: "industries.md#the-six-districts",
      alt: "Six district buildings in a ring around the island, each with a lock and a key shaped like a stock-token coin.",
      width: 1672,
      height: 941,
      artLeft: 90,
      artTop: 0,
      artWidth: 1200,
      introTop: 211,
    },
    {
      n: 9,
      anchor: "your-key",
      dir: "09-your-key-ready",
      eyebrow: "09 — DISTRICTS",
      title: ["The key stays yours"],
      intro: `A staked token doesn't go to the game. It waits in a contract, and you can ask for it back at any time. It comes home after ${facts.unstakeDays} city days.`,
      note: "You can't cancel an unstake. Asking again while tokens are cooling restarts the clock.",
      linkLabel: "More in the handbook → Unstaking and the cooldown",
      ref: "industries.md#unstaking-and-the-cooldown",
      alt: "A key taken from a lock leads two ways: a short path where the district frosts over after a day, and a long one through a calendar to a wallet.",
      width: 1672,
      height: 941,
      artLeft: 90,
      artTop: 0,
      artWidth: 1200,
      introTop: 211,
    },
    {
      n: 10,
      anchor: "seasons",
      dir: "10-seasons-ready",
      eyebrow: "10 — SEASONS",
      title: ["Not the biggest,", "the best run"],
      intro:
        "Every day your city scores Influence: how much Payroll it got for every Capital it has spent. The best-run cities, not the biggest, share prizes in stock tokens.",
      note: "Prizes are stock tokens bought with the trading toll, not other players' Capital. You claim them yourself.",
      linkLabel: "More in the handbook → Seasons and Rewards",
      ref: "seasons.md",
      alt: "Scales tip toward a small, fully lit piece of island; beside them a ten-step podium with shrinking stacks of tokens.",
      width: 1672,
      height: 941,
      artLeft: 110,
      artTop: 0,
      artWidth: 1180,
      introTop: 270,
    },
    {
      n: 11,
      anchor: "before",
      dir: "11-before-ready",
      eyebrow: "11 — BEFORE YOU GO",
      title: ["Before you go in"],
      intro:
        "Nobody here promises a profit. Prices move both ways, the tank is shared and finite, and the Bank keeps hours. Try the demo city first: no wallet, nothing at stake.",
      note: "Corporator hasn't launched yet. This book tells the rules as they stand today.",
      linkLabel: "More in the handbook → Risks",
      ref: "protocol.md#risks",
      alt: "The island at dusk with a signpost to Demo and Handbook; the engineer waves goodbye from the Workshop door.",
      width: 1602,
      height: 981,
      artLeft: 270,
      artTop: 0,
      artWidth: 1100,
      introTop: 211,
    },
  ]
}

export function bookAnchorOf(hash: string): string {
  const pages = bookPages({
    neighbourPct: 0,
    offlineHours: 0,
    boostLaunch: 0,
    boostLaunchDays: 0,
    boost: 0,
    roundTripPct: "",
    unstakeDays: 0,
  })
  const found = pages.find((page) => page.anchor === hash)
  return found === undefined ? "island" : found.anchor
}

export function readBookAnchor(): string {
  const hash = window.location.hash.startsWith("#") ? decodeURIComponent(window.location.hash.slice(1)) : ""
  return bookAnchorOf(hash)
}

export function rememberBookAnchor(anchor: string): void {
  try {
    sessionStorage.setItem(BOOK_STORAGE_KEY, anchor)
  } catch {
    // Private mode can refuse storage. The address hash still holds the page.
  }
}

export function savedBookAnchor(): string {
  try {
    const value = sessionStorage.getItem(BOOK_STORAGE_KEY)
    return value === null ? "island" : bookAnchorOf(value)
  } catch {
    return "island"
  }
}
