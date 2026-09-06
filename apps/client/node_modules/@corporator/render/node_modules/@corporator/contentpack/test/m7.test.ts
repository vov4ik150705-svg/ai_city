import { readFileSync } from "node:fs"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"
import { describe, expect, it } from "vitest"

const repo = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "..")

type ParamRow = { readonly v: number }
type SectionFile = {
  readonly params: Readonly<Record<string, ParamRow | undefined>>
}

type KotsFixture = {
  readonly creator_tax_bps: number
}

function loadEconomy(): SectionFile {
  return JSON.parse(readFileSync(join(repo, "content/params/economy.json"), "utf8")) as SectionFile
}

function loadLaunch(): SectionFile {
  return JSON.parse(readFileSync(join(repo, "content/params/launch.json"), "utf8")) as SectionFile
}

function loadKots(): KotsFixture {
  return JSON.parse(readFileSync(join(repo, "content/fixtures/kottara_launch.json"), "utf8")) as KotsFixture
}

function param(file: SectionFile, name: string): number {
  const row = file.params[name]
  if (row === undefined) throw new Error(name)
  return row.v
}

describe.sequential("M7 construction", () => {
  it("pack_tax_equals_deploy_rate", () => {
    const econ = loadEconomy()
    const tax = param(econ, "creator_tax_bps")
    const kots = loadKots().creator_tax_bps
    const constants = readFileSync(join(repo, "contracts", "test", "PackConstants.sol"), "utf8")
    expect(tax).toBe(200)
    expect(kots).toBe(100)
    expect(tax).not.toBe(kots)
    expect(constants.includes(`CREATOR_TAX_BPS = ${tax}`)).toBe(true)
    expect(constants.includes(`CREATOR_TAX_BPS = ${kots}`)).toBe(false)
  })

  it("vitrine_under_factory_ceiling", () => {
    const econ = loadEconomy()
    const launch = loadLaunch()
    const tax = param(econ, "creator_tax_bps")
    const curve = param(econ, "curve_fee_bps")
    const cap = param(launch, "max_creator_tax_bps")
    const visible = tax + curve
    expect(tax).toBeLessThanOrEqual(cap)
    expect(visible).toBeLessThanOrEqual(cap)
    expect(visible).toBe(tax + curve)
    expect(1100 > cap).toBe(true)
    expect(tax + 900 > cap).toBe(true)
    expect(cap).toBe(1000)
  })
})
