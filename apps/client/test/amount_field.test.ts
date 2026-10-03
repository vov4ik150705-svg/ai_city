import { describe, expect, it } from "vitest"
import { amountFieldText, amountInsertAllowed, moneyAtoms } from "../src/hud/parts/si.ts"

const wei = 18n

describe("amount fields reject letters", () => {
  it("drops letters from a whole Capital amount", () => {
    expect(amountFieldText("каппапавпва", "whole", wei)).toBe("")
    expect(amountFieldText("12a3", "whole", wei)).toBe("123")
    expect(amountFieldText("10,000", "whole", wei)).toBe("10000")
    expect(amountFieldText("1.25", "whole", wei)).toBe("125")
    expect(amountFieldText("-5", "whole", wei)).toBe("5")
    expect(amountFieldText("１２３", "whole", wei)).toBe("")
    expect(amountInsertAllowed("к", "whole", wei)).toBe(false)
    expect(amountInsertAllowed("4", "whole", wei)).toBe(true)
    expect(moneyAtoms(amountFieldText("каппапавпва", "whole", wei), "capital", wei)).toBeUndefined()
    expect(moneyAtoms(amountFieldText("12a3", "whole", wei), "capital", wei)).toBe(123n)
  })

  it("keeps one dot and a fractional cap on a $CORP amount", () => {
    expect(amountFieldText("1.2.3a", "decimal", wei)).toBe("1.23")
    expect(amountFieldText("1.23456", "decimal", 4n)).toBe("1.2345")
    expect(amountFieldText("кап1.5", "decimal", wei)).toBe("1.5")
    expect(amountFieldText(".", "decimal", 0n)).toBe("")
    expect(amountInsertAllowed(".", "decimal", wei)).toBe(true)
    expect(amountInsertAllowed(".", "whole", wei)).toBe(false)
    expect(moneyAtoms(amountFieldText("1.2.3a", "decimal", wei), "corp", wei)).toBe(1230000000000000000n)
  })
})
