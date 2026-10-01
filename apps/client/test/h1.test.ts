import { describe, expect, it } from "vitest"
import { snapshotFromEnvelope } from "../src/boot.ts"
import { formatWalletLabel } from "../src/hud/fields.ts"
import { emptySnapshot } from "../src/hud/snapshot.ts"

describe("H1 snapshotFromEnvelope", () => {
  it("reads_projected_channels_without_inventing_corp", () => {
    const snap = snapshotFromEnvelope({
      city_time: 12n,
      account_kind: "wallet",
      sections: {
        "aggregate.gdp": 40n,
        "aggregate.happiness": 8000n,
        "aggregate.stability": 7000n,
        "tick.building_level": {
          rows: [{ id: "workshop", nameKey: "UI_BLD_WORKSHOP", statusKey: "UI_AVAILABLE" }],
          population: 12n,
          city_level: 2n,
          productivity: 5000n,
        },
        "tick.agent_state": {
          rows: [{ id: "h1", idleKey: "IDLE_NO_COMPUTE" }],
        },
        "oracle.stock_price": {
          live: false,
          rows: [{ ticker: "NVDA", price: "", day_pct: "", effect: "10300" }],
        },
        "seasons.influence_rank": {
          rank: 3n,
          influence: 11n,
          positive_days: 4n,
          qualified: 1n,
          season_label: "S1",
          period_label: "P2",
        },
        "fragments.city_ledger": { rows: [{ ticker: "NVDA", amount: 7n }] },
        "wallet.stake_tokens": 5n,
        "wallet.corp_balance": {},
        "wallet.chain": {},
      },
    })
    expect(snap.gdp).toBe(40n)
    expect(snap.happiness).toBe(8000n)
    expect(snap.stability).toBe(7000n)
    expect(snap.population).toBe(12n)
    expect(snap.cityLevel).toBe(2n)
    expect(snap.productivity).toBe(5000n)
    expect(snap.functions).toEqual([
      { id: "workshop", nameKey: "UI_BLD_WORKSHOP", statusKey: "UI_AVAILABLE", level: undefined, worker: "", task: "" },
    ])
    expect(snap.agents).toEqual([
      {
        id: "h1",
        idleKey: "IDLE_NO_COMPUTE",
        role: "",
        buildingId: "",
        objective: "",
        level: 0n,
        xp: 0n,
        traits: [],
      },
    ])
    expect(snap.quoteLive).toBe(false)
    expect(snap.quoteAgeMs).toBeUndefined()
    expect(snap.corp).toBeUndefined()
    expect(snap.seasonLabel).toBe("S1")
    expect(snap.periodLabel).toBe("P2")
    expect(snap.influenceRank).toEqual({
      rank: 3n,
      influence: 11n,
      positiveDays: 4n,
      qualified: true,
      board: [],
      prizeBoard: [],
    })
    expect(snap.fragmentLedger).toEqual([{ ticker: "NVDA", amount: 7n }])
    expect(snap.stake).toBe(5n)
    expect(snap.stocks).toEqual([{ ticker: "NVDA", price: "", dayPct: "", effect: "10300" }])
  })

  it("keeps_server_board_order_and_shortens_wallet_label", () => {
    const snap = snapshotFromEnvelope({
      city_time: 1n,
      account_kind: "wallet",
      sections: {
        "seasons.influence_rank": {
          influence: 0n,
          positive_days: 0n,
          qualified: 0n,
          board: [
            {
              rank: 1n,
              wallet: "player-one-very-long-wallet",
              influence: 0n,
              gdp: 3n,
              positive_days: 0n,
              qualified: 0n,
              self: 0n,
            },
            {
              rank: 2n,
              wallet: "w2",
              influence: 9n,
              gdp: 1n,
              positive_days: 0n,
              qualified: 0n,
              self: 1n,
            },
          ],
        },
      },
    })
    const rank = snap.influenceRank
    expect(rank === undefined).toBe(false)
    if (rank === undefined) return
    const board = rank.board === undefined ? [] : rank.board
    expect(board.map((row) => row.wallet)).toEqual(["player-one-very-long-wallet", "w2"])
    expect(formatWalletLabel("player-one-very-long-wallet")).toBe("player…llet")
    expect(formatWalletLabel("w2")).toBe("w2")
  })

  it("empty_object_channels_stay_unavailable", () => {
    const snap = snapshotFromEnvelope({
      city_time: 1n,
      account_kind: "demo",
      sections: {
        "tick.capital": 1n,
        "wallet.corp_balance": {},
        "tick.building_level": {},
        "tick.agent_state": {},
        "seasons.influence_rank": {},
      },
    })
    expect(snap.capital).toBe(1n)
    expect(snap.corp).toBeUndefined()
    expect(snap.functions).toBeUndefined()
    expect(snap.agents).toBeUndefined()
    expect(snap.influenceRank).toBeUndefined()
    expect(snap.seasonLabel).toBeUndefined()
    expect(emptySnapshot().functions).toBeUndefined()
  })
})
