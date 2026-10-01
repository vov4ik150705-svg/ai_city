import { describe, expect, it } from "vitest"
import { ratingRowsFromBody } from "./ratingBody"

const big = "9007199254740993"

describe("ratingRowsFromBody", () => {
  it("keeps API order and an integer past the safe number limit", () => {
    const text = `{"rows":[{"rank":2,"wallet":"0xdef","influence":${big},"gdp":9,"self":0},{"rank":1,"wallet":"0xabc","influence":1,"gdp":2,"self":1}]}`
    const rows = ratingRowsFromBody(text)
    expect(rows.map((row) => row.wallet)).toEqual(["0xdef", "0xabc"])
    expect(rows[0]?.influence).toBe(big)
    expect(rows[0]?.dayGdp).toBe("9")
    expect(rows[0]?.isYou).toBe(false)
    expect(rows[1]?.isYou).toBe(true)
  })

  it("rejects a float, a missing board, and a row without a wallet", () => {
    expect(() => ratingRowsFromBody(`{"rows":[{"rank":1.5,"wallet":"0xabc","influence":1,"gdp":1,"self":0}]}`)).toThrow()
    expect(() => ratingRowsFromBody(`{"board":[]}`)).toThrow()
    expect(() => ratingRowsFromBody(`{"rows":[{"rank":1,"wallet":"","influence":1,"gdp":1,"self":0}]}`)).toThrow()
    expect(() => ratingRowsFromBody(`{"rows":[],"rows":[]}`)).toThrow()
    expect(ratingRowsFromBody(`{"city_time":1,"rows":[]}`)).toEqual([])
  })
})
