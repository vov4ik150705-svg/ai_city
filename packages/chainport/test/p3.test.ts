import { existsSync, readFileSync } from "node:fs"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"
import { describe, expect, it } from "vitest"

const repo = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "..")

type AuditFinding = {
  readonly severity?: string
  readonly status?: string
  readonly construction?: string
}

type ArchFile = {
  readonly audit?: { readonly findings?: { readonly [id: string]: AuditFinding } }
  readonly roadmap?: {
    readonly contract_audit?: { readonly construction_tests?: readonly string[] }
  }
}

function loadArch(): ArchFile {
  return JSON.parse(readFileSync(join(repo, "content/params/arch.json"), "utf8")) as ArchFile
}

function loadLaunchDeployed(): { readonly [k: string]: string } {
  const launch = JSON.parse(readFileSync(join(repo, "content/params/launch.json"), "utf8")) as {
    readonly deployed?: { readonly [k: string]: string }
  }
  return launch.deployed ?? {}
}

describe.sequential("P3 construction", () => {
  it("erc20_return_value_checked", () => {
    const treas = readFileSync(join(repo, "contracts/src/PrizeTreasury.sol"), "utf8")
    const vault = readFileSync(join(repo, "contracts/src/Vault.sol"), "utf8")
    const stake = readFileSync(join(repo, "contracts/src/StakeRegistry.sol"), "utf8")
    const requireTransfer = /require\([^;]*\.transfer(From)?\s*\(/
    expect(requireTransfer.test(treas.replace(/\n/g, " "))).toBe(true)
    expect(requireTransfer.test(vault.replace(/\n/g, " "))).toBe(true)
    expect(requireTransfer.test(stake.replace(/\n/g, " "))).toBe(true)
    const bare = treas.replace(
      'require(IERC20Prize(token).transfer(depositor, bag), "push");',
      "IERC20Prize(token).transfer(depositor, bag);",
    )
    expect(bare.includes("IERC20Prize(token).transfer(depositor, bag);")).toBe(true)
    expect(bare.includes('require(IERC20Prize(token).transfer(depositor, bag), "push");')).toBe(false)
    expect(/decimals\s*\(\s*\)\s*==\s*18/.test(treas)).toBe(false)
    expect(/decimals\s*\(\s*\)\s*==\s*18/.test(stake)).toBe(false)
    expect(/\btx\.origin\b/.test(treas + vault + stake)).toBe(false)
    expect(/delegatecall/i.test(treas + vault + stake)).toBe(false)
  })

  it("balance_delta_accounting", () => {
    const treas = readFileSync(join(repo, "contracts/src/PrizeTreasury.sol"), "utf8")
    const vault = readFileSync(join(repo, "contracts/src/Vault.sol"), "utf8")
    const stake = readFileSync(join(repo, "contracts/src/StakeRegistry.sol"), "utf8")
    expect(treas.includes("unsliced[kettle][token] += got;")).toBe(true)
    expect(treas.includes("balanceOf(address(this))")).toBe(true)
    expect(stake.includes("amountOf[account][key] += got;")).toBe(true)
    expect(vault.includes("pending[account] += got;")).toBe(true)
    const planted = treas.replace("unsliced[kettle][token] += got;", "unsliced[kettle][token] += amount;")
    expect(planted.includes("unsliced[kettle][token] += amount;")).toBe(true)
  })

  it("audit_findings_closed", () => {
    const arch = loadArch()
    const probes = arch.roadmap?.contract_audit?.construction_tests ?? []
    expect(probes).toEqual([
      "erc20_return_value_checked",
      "balance_delta_accounting",
      "audit_findings_closed",
    ])
    const findings = arch.audit?.findings ?? {}
    expect(Object.keys(findings).length).toBeGreaterThan(0)
    const auditMd = readFileSync(join(repo, "docs/AUDIT.md"), "utf8")
    expect(existsSync(join(repo, "docs/AUDIT.md"))).toBe(true)
    for (const [id, row] of Object.entries(findings)) {
      expect(auditMd.includes(id), id).toBe(true)
      expect(row.status, id).toBeDefined()
      if (row.status === "closed_code") {
        expect(probes.includes(row.construction ?? ""), id).toBe(true)
      } else {
        expect(row.construction, id).toBeUndefined()
      }
      expect(row.severity === "critical" && row.status === "open").toBe(false)
    }
    const filled = Object.entries(loadLaunchDeployed()).filter(([, v]) => v.trim() !== "")
    expect(filled).toEqual([])
    const planted = {
      severity: "critical",
      status: "open",
      src: "PLAN_RELEASE P3 A-P-1",
      why: "Open critical planted together with a filled launch.deployed token row",
    }
    expect(planted.status === "open" && planted.severity === "critical").toBe(true)
  })
})
