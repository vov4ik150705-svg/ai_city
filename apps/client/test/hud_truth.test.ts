import { readFileSync } from "node:fs"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"
import { createElement } from "react"
import { renderToStaticMarkup } from "react-dom/server"
import { describe, expect, it } from "vitest"
import { loadPack, parseJson, type Json } from "@corporator/contentpack"
import { codes, commandTemplate } from "@corporator/protocol"
import {
  buildHud,
  createLiveAdapter,
  dispatchFromEffect,
  emptySnapshot,
  intentFromCommit,
  isMoneyReviewIntent,
  isUiLocalEffect,
  loadClientPack,
  loadIntentSeq,
  loadStringTable,
  scopedIntentId,
  storeIntentSeq,
  transportOf,
} from "../src/index.ts"
import { ActionButton } from "../src/hud/parts/ActionButton.tsx"
import type { ScreenProps } from "../src/hud/parts/ScreenFrame.tsx"
import { reviewTxn } from "../src/hud/uiState.ts"
import { BankScreen, commitMoney, withdrawLiveEnabled } from "../src/hud/screens/bank.tsx"
import {
  ExchangeScreen,
  exchangeLevelGate,
  liveQuoteExecutable,
  liveQuoteKind,
} from "../src/hud/screens/exchange.tsx"
import { JournalFromLog } from "../src/hud/workspace/JournalFromLog.tsx"

const repo = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "..")

function packBytes(): Uint8Array {
  return new Uint8Array(readFileSync(join(repo, "content/out/pack.json")))
}

function readJson(rel: string): Json {
  return parseJson(readFileSync(join(repo, rel), "utf8"))
}

function markup(node: ReturnType<typeof createElement>): string {
  return renderToStaticMarkup(node)
}

describe("HUD data/action/transaction truthfulness", () => {
  const pack = loadClientPack(loadPack(packBytes()).pack)
  const strings = loadStringTable(readJson("content/strings/en.json"))

  function viewOf(snap = emptySnapshot()) {
    return buildHud({
      pack,
      strings,
      snapshot: snap,
      nowMs: 0n,
      firstLoginMs: 0n,
      demo: false,
    })
  }

  function propsOf(args: { readonly snap?: ReturnType<typeof emptySnapshot>; readonly txn?: ScreenProps["moneyTxn"] }): ScreenProps {
    return {
      view: viewOf(args.snap),
      pack,
      strings,
      demo: false,
      failed: new Set(),
      loading: false,
      onClose: () => {},
      onNavigate: () => {},
      pendingCell: "",
      pendingTileX: 0n,
      pendingTileY: 0n,
      onIntent: async () => {},
      onCommit: async () => {},
      moneyTxn: args.txn,
      onMoneyTxn: () => {},
      onLocal: () => {},
    }
  }

  function silentAdapter() {
    let postCalls = 0
    const adapter = createLiveAdapter({
      origin: "http://adapter.test",
      cityId: "a",
      sessionId: "s",
      commandTemplate,
      post: async () => {
        throw new Error(codes.API_MALFORMED)
      },
      cityTime: () => 7n,
      nextSeq: () => 1n,
      fetchSnapshot: async () => emptySnapshot(),
      postCommand: async () => {
        postCalls += 1
        return { status: 200, body: new Uint8Array() }
      },
    })
    return { adapter, posts: () => postCalls }
  }

  it("keeps unsupported action unavailable without posting", async () => {
    const { adapter, posts } = silentAdapter()
    const blocked = await adapter.dispatch({ kind: "research_start", axisId: "grid" })
    expect(transportOf("research_start")).toBe("unsupported")
    expect(blocked.kind).toBe("unavailable")
    if (blocked.kind === "unavailable") {
      expect(blocked.reason).toBe("no-live-route")
      expect(blocked.code).toBe(codes.FEATURE_NOT_IN_V1)
    }
    expect(posts()).toBe(0)
    const unknown = await adapter.dispatch({ kind: "local", effect: "raw-command" })
    expect(isUiLocalEffect("raw-command")).toBe(false)
    expect(unknown.kind).toBe("unavailable")
    expect(posts()).toBe(0)
    const viaEffect = await dispatchFromEffect(adapter.dispatch, "raw-command")
    expect(viaEffect.kind).toBe("unavailable")
    expect(posts()).toBe(0)
    const hireMap = intentFromCommit("hire")
    expect(hireMap.kind).toBe("hire")
  })

  it("does not treat claim_prize as confirmed custody", async () => {
    const { adapter, posts } = silentAdapter()
    expect(transportOf("claim_prize")).toBe("refusal-only")
    expect(isMoneyReviewIntent("claim_prize")).toBe(false)
    const claimed = await adapter.dispatch({ kind: "claim_prize" })
    expect(claimed.kind).toBe("unavailable")
    if (claimed.kind === "unavailable") expect(claimed.code).toBe(codes.FEATURE_NOT_IN_V1)
    expect(posts()).toBe(0)
    const html = markup(createElement(ActionButton, { ...propsOf({}), actionId: "leaderboard_claim" }))
    expect(html.includes("data-intent=\"claim_prize\"")).toBe(true)
    expect(html.includes("data-support=\"refusal-only\"")).toBe(true)
    expect(html.includes("data-unsupported=\"1\"")).toBe(true)
    expect(html.includes("disabled")).toBe(true)
    expect(html.includes("data-state=\"unavailable\"") || html.includes("hud-unavailable")).toBe(true)
    expect(html.includes("data-txn=\"confirmed\"")).toBe(false)
  })

  it("does not present a stale or missing quote as executable live quote", () => {
    expect(liveQuoteKind(undefined, undefined)).toBe("unavailable")
    expect(liveQuoteKind(false, 0n)).toBe("stale")
    expect(liveQuoteKind(true, undefined)).toBe("stale")
    expect(liveQuoteKind(true, 0n)).toBe("unavailable")
    expect(liveQuoteExecutable(true, 0n)).toBe(false)
    expect(liveQuoteExecutable(false, 0n)).toBe(false)
    const stale = markup(
      createElement(
        ExchangeScreen,
        propsOf({ snap: { ...emptySnapshot(), quoteLive: false, quoteAgeMs: 0n } }),
      ),
    )
    expect(stale.includes("data-quote-kind=\"stale\"")).toBe(true)
    expect(stale.includes("data-state=\"stale\"")).toBe(true)
    expect(stale.includes("data-quote-source=\"pack\"")).toBe(true)
    expect(stale.includes("data-live=\"0\"")).toBe(true)
    expect(stale.includes("data-quote-kind=\"ready\"")).toBe(false)
    expect(stale.includes("data-city-level-gate=\"unavailable\"")).toBe(true)
    const missing = markup(createElement(ExchangeScreen, propsOf({})))
    expect(missing.includes("data-quote-kind=\"unavailable\"")).toBe(true)
    expect(missing.includes("data-quote-source=\"pack\"")).toBe(true)
    expect(missing.includes("data-live=\"0\"")).toBe(true)
    expect(missing.includes("data-quote-kind=\"ready\"")).toBe(false)
    expect(missing.includes("data-hours-open=\"0\"")).toBe(true)
    const pretendLive = markup(
      createElement(
        ExchangeScreen,
        propsOf({ snap: { ...emptySnapshot(), quoteLive: true, quoteAgeMs: 0n } }),
      ),
    )
    expect(pretendLive.includes("data-quote-kind=\"ready\"")).toBe(false)
    expect(pretendLive.includes("data-live=\"0\"")).toBe(true)
    expect(pretendLive.includes("data-quote-source=\"pack\"")).toBe(true)
    expect(exchangeLevelGate(viewOf().shell.cityLevel)).toBe("unavailable")
    expect(exchangeLevelGate(viewOf({ ...emptySnapshot(), cityLevel: 1n }).shell.cityLevel)).toBe("locked")
    const noonOpen = viewOf({ ...emptySnapshot(), cityTime: 12n, cityLevel: 3n })
    expect(exchangeLevelGate(noonOpen.shell.cityLevel)).toBe("open")
    const gated = markup(
      createElement(
        ExchangeScreen,
        propsOf({ snap: { ...emptySnapshot(), cityTime: 12n, cityLevel: 1n, quoteLive: true, quoteAgeMs: 0n } }),
      ),
    )
    expect(gated.includes("data-city-level-gate=\"locked\"")).toBe(true)
    expect(gated.includes("data-hours-open=\"1\"")).toBe(true)
    expect(gated.includes("disabled")).toBe(true)
  })

  it("disables bank withdraw when live daily limit is unavailable or zero", () => {
    expect(withdrawLiveEnabled(undefined)).toBe(false)
    expect(withdrawLiveEnabled(0n)).toBe(false)
    expect(withdrawLiveEnabled(1n)).toBe(true)
    const missing = markup(createElement(BankScreen, propsOf({})))
    expect(missing.includes("data-withdraw-open=\"0\"")).toBe(true)
    expect(missing.includes("data-hours-open=\"0\"")).toBe(true)
    const zero = markup(
      createElement(BankScreen, propsOf({ snap: { ...emptySnapshot(), bankLimitLive: 0n } })),
    )
    expect(zero.includes("data-withdraw-open=\"0\"")).toBe(true)
    const open = markup(
      createElement(BankScreen, propsOf({ snap: { ...emptySnapshot(), bankLimitLive: 12n } })),
    )
    expect(open.includes("data-withdraw-open=\"1\"")).toBe(true)
    expect(open.includes("data-hours-open=\"0\"")).toBe(true)
    expect(missing.includes("BANK_DAILY_LIMIT_REACHED")).toBe(false)
    expect(zero.includes("BANK_DAILY_LIMIT_REACHED")).toBe(false)
    const hoursOpen = markup(
      createElement(
        BankScreen,
        propsOf({ snap: { ...emptySnapshot(), cityTime: 12n, bankLimitLive: 12n } }),
      ),
    )
    expect(hoursOpen.includes("data-hours-open=\"1\"")).toBe(true)
    expect(hoursOpen.includes("data-hours-reason=\"UI_BANK\"")).toBe(true)
    const sunday = 6n * pack.ticksDay + 12n
    const sundayHtml = markup(
      createElement(
        BankScreen,
        propsOf({ snap: { ...emptySnapshot(), cityTime: sunday, bankLimitLive: 12n } }),
      ),
    )
    expect(sundayHtml.includes("data-hours-open=\"0\"")).toBe(true)
    expect(sundayHtml.includes("data-hours-reason=\"BANK_SUNDAY\"")).toBe(true)
    expect(sundayHtml.includes("BANK_DAILY_LIMIT_REACHED")).toBe(false)
  })

  it("labels bank and exchange amounts with Capital, $CORP, and selected Stock Token", () => {
    const bank = markup(createElement(BankScreen, propsOf({})))
    expect(bank.includes("data-unit=\"UI_CORP\"")).toBe(true)
    expect(bank.includes("data-receive-unit=\"UI_CAPITAL\"")).toBe(true)
    expect(bank.includes(strings["UI_CORP"] ?? "$CORP")).toBe(true)
    const exchange = markup(createElement(ExchangeScreen, propsOf({})))
    expect(exchange.includes("data-unit=\"UI_CORP\"")).toBe(true)
    expect(exchange.includes("data-unit=\"UI_TICKER\"")).toBe(true)
    const ticker = pack.districts[0]?.ticker ?? ""
    expect(ticker.length > 0).toBe(true)
    expect(exchange.includes(`data-stock-token="${ticker}"`)).toBe(true)
    expect(exchange.includes(`data-receive-unit="${ticker}"`)).toBe(true)
    const review = markup(createElement(BankScreen, propsOf({ txn: reviewTxn() })))
    expect(review.includes("data-txn=\"review\"")).toBe(true)
    expect(review.includes("data-txn=\"confirmed\"")).toBe(false)
  })

  it("blocks duplicate money submit and does not confirm without applied live result", async () => {
    const kinds: string[] = []
    await commitMoney(reviewTxn(), (s) => {
      kinds.push(s === undefined ? "none" : s.kind)
    }, async () => {})
    expect(kinds.join(",")).toBe("submitted,failed")
    let raced = 0
    const review = reviewTxn()
    await Promise.all([
      commitMoney(review, () => {}, async () => {
        raced += 1
      }),
      commitMoney(review, () => {}, async () => {
        raced += 1
      }),
    ])
    expect(raced).toBe(1)
    const appliedKinds: string[] = []
    await commitMoney(reviewTxn(), (s) => {
      appliedKinds.push(s === undefined ? "none" : s.kind)
    }, async () => ({
      kind: "applied",
      intent: "hire",
      effect: "hire",
      snapshot: emptySnapshot(),
      intentId: "a:7:1",
    }))
    expect(appliedKinds.join(",")).toBe("submitted,confirmed")
    const prizeKinds: string[] = []
    await commitMoney(reviewTxn(), (s) => {
      prizeKinds.push(s === undefined ? "none" : s.kind)
    }, async () => ({
      kind: "applied",
      intent: "claim_prize",
      effect: "claim_prize",
      snapshot: emptySnapshot(),
      intentId: "a:7:2",
    }))
    expect(prizeKinds.join(",")).toBe("submitted,failed")
    const deposit = await silentAdapter().adapter.dispatch({
      kind: "deposit",
      amount: "1",
    })
    expect(deposit.kind).toBe("unavailable")
    expect(intentFromCommit("deposit", { amount: "1" }).kind).toBe("deposit")
    expect(scopedIntentId("a", "s1", 7n, 1n)).not.toBe(scopedIntentId("a", "s2", 7n, 1n))
    const mem: { [key: string]: string } = {}
    const storage = {
      getItem: (key: string): string | null => mem[key] ?? null,
      setItem: (key: string, value: string): void => {
        mem[key] = value
      },
    }
    expect(loadIntentSeq("sess", storage)).toBe(0n)
    storeIntentSeq("sess", 4n, storage)
    expect(loadIntentSeq("sess", storage)).toBe(4n)
    expect(loadIntentSeq("other", storage)).toBe(0n)
    expect(viewOf().shell.events.kind).toBe("unavailable")
    expect(viewOf().shell.notifications.kind).toBe("unavailable")
    const missingLog = markup(
      createElement(JournalFromLog, {
        view: viewOf(),
        strings,
        extra: [{ id: "fake", key: "IDLE_NO_ENERGY", text: "fake" }],
        openId: "",
        onBadge: () => {},
      }),
    )
    expect(missingLog.includes("data-log-kind=\"unavailable\"")).toBe(true)
    expect(missingLog.includes("fake")).toBe(false)
    const emptyLog = markup(
      createElement(JournalFromLog, {
        view: viewOf({ ...emptySnapshot(), log: [] }),
        strings,
        extra: [],
        openId: "",
        onBadge: () => {},
      }),
    )
    expect(emptyLog.includes("data-log-kind=\"empty\"")).toBe(true)
  })
})
