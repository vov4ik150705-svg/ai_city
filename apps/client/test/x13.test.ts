import { readFileSync } from "node:fs"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"
import { createElement } from "react"
import { renderToStaticMarkup } from "react-dom/server"
import { describe, expect, it } from "vitest"
import { loadPack, parseJson, type Json } from "@corporator/contentpack"
import { codes } from "@corporator/protocol"
import { snapshotFromEnvelope } from "../src/boot.ts"
import { chainPayload, commandEffectOf, transportOf } from "../src/hud/liveAdapter.ts"
import { buildHud, emptySnapshot, loadClientPack, loadStringTable } from "../src/index.ts"
import { DistrictStakeBox, beginClaimUnstaked } from "../src/hud/parts/IndustryCard.tsx"
import type { ScreenProps } from "../src/hud/parts/ScreenFrame.tsx"
import { BankScreen, beginPresent } from "../src/hud/screens/bank.tsx"
import { ExchangeScreen } from "../src/hud/screens/exchange.tsx"
import { WalletFlyout } from "../src/hud/topbar/WalletFlyout.tsx"

const repo = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "..")

function readJson(rel: string): Json {
  return parseJson(readFileSync(join(repo, rel), "utf8"))
}

function markup(node: ReturnType<typeof createElement>): string {
  return renderToStaticMarkup(node)
}

describe("X13 withdraw HUD", () => {
  const loaded = loadClientPack(loadPack(new Uint8Array(readFileSync(join(repo, "content/out/pack.json")))).pack)
  const strings = loadStringTable(readJson("content/strings/ru.json"))
  const district = loaded.districts[0]
  if (district === undefined) throw new Error("pack has no district")

  function viewOf(snap: ReturnType<typeof emptySnapshot>) {
    return buildHud({
      pack: loaded,
      strings,
      snapshot: snap,
      nowMs: 0n,
      firstLoginMs: 0n,
      demo: false,
    })
  }

  function propsOf(snap: ReturnType<typeof emptySnapshot>, pack = loaded): ScreenProps {
    return {
      view: viewOf(snap),
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
      moneyTxn: undefined,
      onMoneyTxn: () => {},
      onLocal: () => {},
    }
  }

  it("shows an open voucher from the reloaded snapshot", () => {
    const snap = snapshotFromEnvelope({
      city_time: 12n,
      account_kind: "wallet",
      sections: {
        "tick.building_level": {
          chain_time_s: 1000n,
          vouchers: [{ id: "v-open", status: "open", corp: 42n, expires_at_s: 5000n }],
        },
      },
    })
    expect(snap.vouchers?.[0]?.status).toBe("open")
    const html = markup(createElement(BankScreen, { ...propsOf(snap), startTab: "withdraw" }))
    expect(html.includes('data-voucher="open"')).toBe(true)
    expect(html.includes('data-voucher-id="v-open"')).toBe(true)
    expect(html.includes('data-voucher-corp="42"')).toBe(true)
    expect(html.includes('data-exact="5000"')).toBe(true)
    expect(html.includes('data-blocked="0"')).toBe(true)
    expect(html.includes("bankVoucher")).toBe(false)
  })

  it("does not sign a voucher that is still being issued", async () => {
    let signs = 0
    const sent = await beginPresent({
      voucher: { id: "v-sign", status: "signing", corp: "1", expiresAtS: 5000n },
      chainTimeS: 1000n,
      sign: async () => {
        signs += 1
      },
    })
    expect(sent).toBe(false)
    expect(signs).toBe(0)
    const snap = snapshotFromEnvelope({
      city_time: 12n,
      account_kind: "wallet",
      sections: {
        "tick.building_level": {
          chain_time_s: 1000n,
          vouchers: [{ id: "v-sign", status: "signing", corp: 1n, expires_at_s: 5000n }],
        },
      },
    })
    const html = markup(createElement(BankScreen, { ...propsOf(snap), startTab: "withdraw" }))
    expect(html.includes('data-present="signing"')).toBe(true)
    expect(html.includes('data-blocked-code="UI_VOUCHER_SIGNING"')).toBe(true)
    expect(html.includes("disabled")).toBe(true)
    expect(html.includes(strings["UI_VOUCHER_SIGNING"] ?? "")).toBe(true)
    expect(html.includes(strings["UI_PRESENT_GAS"] ?? "")).toBe(true)
  })

  it("does not claim tokens while the cooldown is still running", async () => {
    let signs = 0
    const sent = await beginClaimUnstaked({
      chainTimeS: 1000n,
      readyAtS: 9000n,
      sign: async () => {
        signs += 1
      },
    })
    expect(sent).toBe(false)
    expect(signs).toBe(0)
    const mature = await beginClaimUnstaked({
      chainTimeS: 9000n,
      readyAtS: 9000n,
      sign: async () => {
        signs += 1
      },
    })
    expect(mature).toBe(true)
    expect(signs).toBe(1)
    const snap = snapshotFromEnvelope({
      city_time: 12n,
      account_kind: "wallet",
      sections: {
        "tick.building_level": {
          chain_time_s: 1000n,
          unstake_cooldown: { [district.ticker]: { amount: 5n, ready_at_s: 9000n } },
        },
      },
    })
    const html = markup(
      createElement(DistrictStakeBox, {
        districtId: district.id,
        screen: propsOf(snap),
        shortfall: 1n,
        open: true,
        grace: false,
        hint: "hint",
      }),
    )
    expect(html.includes('data-intent="claim_unstaked"')).toBe(true)
    expect(html.includes('data-blocked-code="UNSTAKE_COOLING"')).toBe(true)
    expect(html.includes("disabled")).toBe(true)
    expect(html.includes('data-ready="9000"')).toBe(true)
  })

  it("prints the unstake wait from the pack day count", () => {
    const days = 17n
    const pack = { ...loaded, unstakeCooldownCityDays: days }
    const html = markup(
      createElement(DistrictStakeBox, {
        districtId: district.id,
        screen: propsOf(emptySnapshot(), pack),
        shortfall: 1n,
        open: true,
        grace: false,
        hint: "hint",
      }),
    )
    expect(html.includes('data-unstake-days="17"')).toBe(true)
    expect(html.includes("17")).toBe(true)
    expect(html.includes("суток")).toBe(true)
    expect(html.includes("через 30")).toBe(false)
    expect(loaded.unstakeCooldownCityDays).toBe(30n)
  })

  it("shows the delivered stock amount and a missing wallet balance as a dash", () => {
    const bought = markup(
      createElement(ExchangeScreen, { ...propsOf(emptySnapshot()), stockOut: "77" }),
    )
    expect(bought.includes('data-stock-out="77"')).toBe(true)
    expect(bought.includes(strings["UI_TOKENS_IN_WALLET"] ?? "")).toBe(true)
    const flyout = markup(
      createElement(WalletFlyout, {
        strings,
        state: {
          address: "0xabc",
          chainWrong: false,
          corpDisplay: undefined,
          stocks: [{ ticker: district.ticker, display: undefined }],
          chainId: 1n,
        },
        onConnect: async () => "",
        onDisconnect: () => {},
        onOpenBank: () => {},
        onClose: () => {},
      }),
    )
    expect(flyout.includes(`data-wallet-stock="${district.ticker}"`)).toBe(true)
    expect(flyout.includes('data-missing="1"')).toBe(true)
    expect(flyout.includes("—")).toBe(true)
    expect(transportOf("claim_unstaked")).toBe("live")
    expect(transportOf("claim_fragment")).toBe("live")
    expect(commandEffectOf("claim_unstaked")).toBe("claim_unstaked")
    const presentBody = chainPayload({ kind: "present_voucher", voucherId: "vouch-9" }, undefined, { phase: "prepare" })
    expect(presentBody["voucher_id"]).toBe("vouch-9")
    expect(presentBody["phase"]).toBe("prepare")
    const barePresent = chainPayload({ kind: "present_voucher" }, undefined, { phase: "prepare" })
    expect(barePresent["voucher_id"]).toBeUndefined()
    const claimBody = chainPayload({ kind: "claim_unstaked", districtId: "finance" }, undefined, { phase: "prepare" })
    expect(claimBody["district_id"]).toBe("finance")
    const bareClaim = chainPayload({ kind: "claim_unstaked", districtId: "" }, undefined, { phase: "prepare" })
    expect(bareClaim["district_id"]).toBeUndefined()
    expect(commandEffectOf("withdraw")).toBe("withdraw")
    expect(codes.FRAGMENT_SLICE_PENDING).toBe("FRAGMENT_SLICE_PENDING")
  })
})
