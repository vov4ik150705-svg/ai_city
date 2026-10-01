import { readFileSync } from "node:fs"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"
import { createElement } from "react"
import { renderToStaticMarkup } from "react-dom/server"
import { describe, expect, it } from "vitest"
import { loadPack, parseJson, canonical, type Json } from "@corporator/contentpack"
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
  orderedExchangeDistricts,
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

  function propsOf(args: {
    readonly snap?: ReturnType<typeof emptySnapshot>
    readonly txn?: ScreenProps["moneyTxn"]
    readonly demo?: boolean
  }): ScreenProps {
    return {
      view: viewOf(args.snap),
      pack,
      strings,
      demo: args.demo === true,
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
    const presented = await adapter.dispatch({ kind: "present_voucher" }, { voucher_id: "v1" })
    expect(transportOf("present_voucher")).toBe("live")
    expect(transportOf("assign")).toBe("live")
    expect(presented.kind).toBe("applied")
    expect(posts()).toBe(1)
    const unknown = await adapter.dispatch({ kind: "local", effect: "raw-command" })
    expect(isUiLocalEffect("raw-command")).toBe(false)
    expect(unknown.kind).toBe("unavailable")
    expect(posts()).toBe(1)
    const viaEffect = await dispatchFromEffect(adapter.dispatch, "raw-command")
    expect(viaEffect.kind).toBe("unavailable")
    expect(posts()).toBe(1)
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
    expect(
      html.includes("hud-unavailable") ||
        html.includes(codes.WALLET_NOT_CONNECTED) ||
        html.includes(codes.DEMO_NO_PRIZE),
    ).toBe(true)
    expect(html.includes("data-txn=\"confirmed\"")).toBe(false)
    let livePosts = 0
    const unpaid = createLiveAdapter({
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
      launchReady: true,
      postCommand: async () => {
        livePosts += 1
        return {
          status: 200,
          body: canonical({
            effect: "claim_prize",
            assets: [{ asset: "NVDA", paid: 0n, code: codes.PRIZE_CLAIM_UNCOVERED }],
          }),
        }
      },
    })
    const unpaidClaim = await unpaid.dispatch({ kind: "claim_prize" })
    expect(livePosts).toBe(1)
    expect(unpaidClaim.kind).toBe("failed")
    if (unpaidClaim.kind === "failed") {
      expect(unpaidClaim.code).toBe(codes.PRIZE_CLAIM_UNCOVERED)
    }
  })

  it("does not present a stale or missing quote as executable live quote", () => {
    expect(liveQuoteKind(undefined, undefined)).toBe("unavailable")
    expect(liveQuoteKind(false, 0n)).toBe("stale")
    expect(liveQuoteKind(true, undefined)).toBe("stale")
    expect(liveQuoteKind(true, 0n)).toBe("unavailable")
    expect(liveQuoteKind(true, 1n)).toBe("ready")
    expect(liveQuoteExecutable(true, 0n)).toBe(false)
    expect(liveQuoteExecutable(true, 1n)).toBe(true)
    expect(liveQuoteExecutable(false, 0n)).toBe(false)
    const stale = markup(
      createElement(
        ExchangeScreen,
        propsOf({ snap: { ...emptySnapshot(), quoteLive: false, quoteAgeMs: 0n } }),
      ),
    )
    expect(stale.includes("data-quote-kind=\"stale\"")).toBe(true)
    expect(stale.includes("data-state=\"stale\"")).toBe(true)
    expect(stale.includes("data-quote-source=\"pack\"")).toBe(false)
    expect(stale.includes(`${viewOf().quoteLo}–${viewOf().quoteHi}`)).toBe(false)
    expect(stale.includes("data-live=\"0\"")).toBe(true)
    expect(stale.includes("data-quote-kind=\"ready\"")).toBe(false)
    expect(stale.includes("data-city-level-gate=\"unavailable\"")).toBe(true)
    const missing = markup(createElement(ExchangeScreen, propsOf({})))
    expect(missing.includes("data-quote-kind=\"unavailable\"")).toBe(true)
    expect(missing.includes("data-quote-source=\"pack\"")).toBe(false)
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
    expect(pretendLive.includes("data-quote-source=\"pack\"")).toBe(false)
    const levelNeed = pack.buildingMeta["exchange"]?.cityLevelReq
    if (levelNeed === undefined) throw new Error("exchange level")
    expect(exchangeLevelGate(viewOf().shell.cityLevel, levelNeed)).toBe("unavailable")
    expect(exchangeLevelGate(viewOf({ ...emptySnapshot(), cityLevel: 1n }).shell.cityLevel, levelNeed)).toBe("locked")
    const noonOpen = viewOf({ ...emptySnapshot(), cityTime: 12n, cityLevel: 3n })
    expect(exchangeLevelGate(noonOpen.shell.cityLevel, levelNeed)).toBe("open")
    const gated = markup(
      createElement(
        ExchangeScreen,
        propsOf({ snap: { ...emptySnapshot(), cityTime: 12n, cityLevel: 1n, quoteLive: true, quoteAgeMs: 0n } }),
      ),
    )
    expect(gated.includes("data-city-level-gate=\"locked\"")).toBe(true)
    expect(gated.includes("data-hours-open=\"1\"")).toBe(true)
    expect(gated.includes("disabled")).toBe(true)
    expect(gated.includes("data-key=\"UI_QUOTE_UNAVAILABLE\"")).toBe(false)
    expect(gated.includes("<select")).toBe(false)
    expect(stale.includes("data-buy-stock=\"live\"")).toBe(false)
    expect(stale.includes("data-buy-stock=\"blocked\"")).toBe(true)
    expect(stale.includes("data-hop-priced=\"0\"")).toBe(true)
    expect(stale.includes(codes.BANK_CLOSED)).toBe(true)
    expect(stale.includes("data-blocked-code=\"EXCHANGE_HOP_UNAVAILABLE\"")).toBe(false)
    expect(stale.includes("data-key=\"UI_REVIEW_TXN\"")).toBe(false)
    expect(stale.includes("data-key=\"UI_CONFIRM\"")).toBe(false)
    expect(pretendLive.includes("data-buy-stock=\"live\"")).toBe(false)
    expect(pretendLive.includes("data-hop-priced=\"0\"")).toBe(true)
    const leftoverReview = markup(createElement(ExchangeScreen, propsOf({ txn: reviewTxn() })))
    expect(leftoverReview.includes("data-buy-stock=\"live\"")).toBe(false)
    expect(leftoverReview.includes("data-action=\"exchange_buy\"")).toBe(false)
    expect(leftoverReview.includes("data-key=\"UI_CONFIRM\"")).toBe(false)
    expect(leftoverReview.includes(codes.BANK_CLOSED)).toBe(true)
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
    const withdrawTab = markup(createElement(BankScreen, { ...propsOf({}), startTab: "withdraw" }))
    expect(withdrawTab.includes('data-intent="present_voucher"')).toBe(true)
    expect(withdrawTab.includes('data-present="idle"')).toBe(true)
    expect(withdrawTab.includes('data-blocked-code="UI_NO_VOUCHER"')).toBe(true)
    expect(withdrawTab.includes('data-key="UI_ESTIMATE_UNAVAILABLE"')).toBe(true)
    expect(withdrawTab.includes("~4.5")).toBe(false)
    expect(withdrawTab.includes("40000")).toBe(false)
    expect(withdrawTab.includes("25%")).toBe(false)
    expect(withdrawTab.includes('data-action="bank_withdraw"')).toBe(false)
    const withdrawReview = markup(
      createElement(BankScreen, { ...propsOf({ txn: reviewTxn() }), startTab: "withdraw" }),
    )
    expect(withdrawReview.includes('data-action="bank_withdraw"')).toBe(true)
    expect(withdrawReview.includes('data-key="UI_CONFIRM"')).toBe(true)
    expect(withdrawReview.includes('data-key="UI_ENTRY_CHEAPER"')).toBe(true)
    const withdrawDemo = markup(createElement(BankScreen, { ...propsOf({ demo: true }), startTab: "withdraw" }))
    expect(withdrawDemo.includes("DEMO_NO_WITHDRAW")).toBe(true)
  })

  it("labels bank and exchange amounts with Capital, $CORP, and selected Stock Token", () => {
    const bank = markup(createElement(BankScreen, propsOf({})))
    expect(bank.includes("data-unit=\"UI_CORP\"")).toBe(true)
    expect(bank.includes("data-receive-unit=\"UI_CAPITAL\"")).toBe(true)
    expect(bank.includes(strings["UI_CORP"] ?? "$CORP")).toBe(true)
    const exchange = markup(
      createElement(
        ExchangeScreen,
        propsOf({ snap: { ...emptySnapshot(), cityTime: 12n, cityLevel: 3n, quoteLive: false } }),
      ),
    )
    expect(exchange.includes("data-unit=\"UI_CORP\"")).toBe(true)
    expect(exchange.includes("data-unit=\"UI_TICKER\"")).toBe(true)
    const ticker = orderedExchangeDistricts(pack.districts, pack.prizeAssets)[0]?.ticker ?? ""
    expect(ticker.length > 0).toBe(true)
    expect(exchange.includes(`data-stock-token="${ticker}"`)).toBe(true)
    expect(exchange.includes(`data-receive-unit="${ticker}"`)).toBe(true)
    let tickerAt = -1
    for (const asset of pack.prizeAssets) {
      const at = exchange.indexOf(`data-ticker="${asset}"`)
      expect(at).toBeGreaterThan(tickerAt)
      tickerAt = at
    }
    expect(exchange.includes("<select")).toBe(false)
    expect(exchange.includes("data-key=\"UI_QUOTE_UNAVAILABLE\"")).toBe(true)
    expect(exchange.includes("data-buy-stock=\"blocked\"")).toBe(true)
    expect(exchange.includes("data-hop-priced=\"0\"")).toBe(true)
    expect(exchange.includes("data-action=\"exchange_buy\"")).toBe(false)
    expect(exchange.includes("data-key=\"UI_REVIEW_TXN\"")).toBe(false)
    expect(exchange.includes("data-key=\"UI_CONFIRM\"")).toBe(false)
    expect(exchange.includes("name=\"amount\"")).toBe(false)
    expect(exchange.includes("GOOGL")).toBe(false)
    expect(exchange.includes("USDG")).toBe(false)
    expect(exchange.includes("1,840")).toBe(false)
    expect(exchange.includes("You already hold")).toBe(false)
    expect(exchange.includes("does not automatically")).toBe(false)
    const amountTag = /<input[^>]*id="hud-ex-amount"[^>]*>/.exec(exchange)?.[0] ?? ""
    expect(amountTag.includes("disabled")).toBe(false)
    const tickerTag = /<button[^>]*data-ticker="NVDA"[^>]*>/.exec(exchange)?.[0] ?? ""
    expect(tickerTag.includes("disabled")).toBe(false)
    expect(exchange.includes('data-ticker-mark="NVDA"')).toBe(true)
    expect(exchange.includes('data-ticker-mark="COIN"')).toBe(true)
    expect(exchange.includes("Compute")).toBe(true)
    expect(exchange.includes("Finance")).toBe(true)
    const walletDead = markup(
      createElement(
        ExchangeScreen,
        propsOf({
          snap: {
            ...emptySnapshot(),
            cityTime: 12n,
            cityLevel: 3n,
            accountKind: "wallet",
            corp: 50n,
            quoteLive: false,
            gate: { chainWrong: true, openedDistricts: undefined, districts: undefined, stakeThresholdMet: undefined, tierUnlocked: undefined, stakeMultMet: undefined, nodeSideOpen: undefined, mergeFree: undefined },
          },
        }),
      ),
    )
    expect(walletDead.includes("data-refusal=\"WALLET_WRONG_CHAIN\"")).toBe(true)
    expect(walletDead.includes("data-exact=\"50\"")).toBe(true)
    const review = markup(createElement(BankScreen, propsOf({ txn: reviewTxn() })))
    expect(review.includes("data-txn=\"review\"")).toBe(true)
    expect(review.includes("data-txn=\"confirmed\"")).toBe(false)
    expect(review.includes("data-action=\"bank_deposit\"")).toBe(true)
    expect(review.includes("data-key=\"UI_CONFIRM\"")).toBe(true)
    expect(review.includes("data-dialog=\"review\"")).toBe(true)
    expect(review.includes("data-key=\"UI_REVIEW_DETAILS\"")).toBe(true)
    expect(review.includes("19,600")).toBe(false)
    expect(review.includes("19600")).toBe(false)
    expect(review.includes("1,830")).toBe(false)
    expect(review.includes("1830")).toBe(false)
    expect(review.includes("data-key=\"UI_REVIEW_TXN\"")).toBe(true)
    expect(transportOf("claim_prize")).toBe("refusal-only")
    expect(transportOf("buy_stock")).toBe("live")
  })

  it("blocks duplicate money submit and does not confirm without applied live result", async () => {
    const kinds: string[] = []
    await commitMoney(reviewTxn(), (s) => {
      kinds.push(s === undefined ? "none" : s.kind)
    }, async () => {})
    expect(kinds.join(",")).toBe("awaiting_authorization,failed")
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
    expect(appliedKinds.join(",")).toBe("awaiting_authorization,confirmed")
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
    expect(prizeKinds.join(",")).toBe("awaiting_authorization,failed")
    const withdrawKinds: string[] = []
    await commitMoney(reviewTxn(), (s) => {
      withdrawKinds.push(s === undefined ? "none" : s.kind)
    }, async () => ({
      kind: "applied",
      intent: "withdraw",
      effect: "withdraw",
      snapshot: emptySnapshot(),
      intentId: "a:7:3",
    }))
    expect(withdrawKinds.join(",")).toBe("awaiting_authorization,confirmed")
    const buyKinds: string[] = []
    await commitMoney(reviewTxn(), (s) => {
      buyKinds.push(s === undefined ? "none" : s.kind)
    }, async () => ({
      kind: "applied",
      intent: "buy_stock",
      effect: "buy_stock",
      snapshot: emptySnapshot(),
      intentId: "a:7:4",
    }))
    expect(buyKinds.join(",")).toBe("awaiting_authorization,confirmed")
    const deposit = await silentAdapter().adapter.dispatch({
      kind: "deposit",
      amount: "1",
    })
    expect(deposit.kind).toBe("applied")
    expect(intentFromCommit("deposit", { amount: "1" }).kind).toBe("deposit")
    expect(intentFromCommit("withdraw", { amount: "1" }).kind).toBe("withdraw")
    expect(intentFromCommit("buy_stock", { ticker: "NVDA", amount: "1" }).kind).toBe("buy_stock")
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
