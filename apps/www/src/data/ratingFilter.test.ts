import { describe, expect, it } from "vitest"
import { filterRatingRows, shortenWallet, type RatingRow } from "./rating"

const board: readonly RatingRow[] = [
  { rank: "1", wallet: "alpha-wallet", influence: "100", dayGdp: "9", isYou: false },
  { rank: "2", wallet: "beta-wallet", influence: "40", dayGdp: "3", isYou: false },
  { rank: "8", wallet: "you-wallet", influence: "10", dayGdp: "1", isYou: true },
]

describe("filterRatingRows", () => {
  it("returns the board in API order when the query is empty or blank", () => {
    expect(filterRatingRows(board, "")).toBe(board)
    expect(filterRatingRows(board, "   ")).toBe(board)
  })

  it("keeps API order and matches the wallet only, case-insensitive contains", () => {
    expect(filterRatingRows(board, "BETA").map((row) => row.rank)).toEqual(["2"])
    expect(filterRatingRows(board, "alpha").map((row) => row.rank)).toEqual(["1"])
    expect(filterRatingRows(board, "wallet").map((row) => row.rank)).toEqual(["1", "2", "8"])
    expect(filterRatingRows(board, "100")).toEqual([])
    expect(filterRatingRows(board, "40")).toEqual([])
    expect(filterRatingRows(board, "8")).toEqual([])
    expect(filterRatingRows([], "0x")).toEqual([])
  })

  it("does not mutate the board", () => {
    const snapshot = board.map((row) => ({ ...row }))
    filterRatingRows(board, "dead")
    expect(board).toEqual(snapshot)
  })
})

describe("shortenWallet", () => {
  it("keeps a short wallet and truncates the middle of a long one", () => {
    expect(shortenWallet("short")).toBe("short")
    expect(shortenWallet("abcdefghijk")).toBe("abcdefghijk")
    expect(shortenWallet("abcdefghijkl")).toBe("abcdef…ijkl")
    expect(shortenWallet("alpha-wallet-middle-tail")).toBe("alpha-…tail")
  })
})
