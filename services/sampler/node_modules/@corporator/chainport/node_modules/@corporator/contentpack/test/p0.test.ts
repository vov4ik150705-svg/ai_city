import { existsSync, readdirSync, readFileSync, statSync } from "node:fs"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"
import { describe, expect, it } from "vitest"

const repo = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "..")

const RELEASE_STAGE_IDS = [
  "release_form",
  "player_identity",
  "ci_tracks",
  "contract_audit",
  "prod_image",
  "time_rehearsal",
  "ops_watch",
  "mainnet_launch",
  "season_one",
] as const

const VISUAL_STAGE_IDS = [
  "visual_form",
  "art_atlas",
  "art_content",
  "render_ground",
  "render_sprites",
  "render_light",
  "render_camera",
  "render_motion",
  "hud_shell",
  "hud_screens",
  "companion_screen",
  "attest_live",
  "visual_close",
] as const

const VISUAL3_STAGE_IDS = [
  "visual3_form",
  "visual3_engine",
  "visual3_assets",
  "visual3_light",
  "visual3_input",
  "visual3_units",
  "visual3_world",
  "visual3_close",
] as const

const ISLAND_STAGE_IDS = [
  "island_form",
  "island_terrain",
  "island_ground",
  "island_decor",
  "island_light",
  "island_compose",
  "island_anchors",
  "island_client",
  "island_close",
] as const

function isPictureStage(id: string): boolean {
  return (
    (VISUAL_STAGE_IDS as readonly string[]).includes(id) ||
    (VISUAL3_STAGE_IDS as readonly string[]).includes(id) ||
    (ISLAND_STAGE_IDS as readonly string[]).includes(id)
  )
}

const V11_OR_MONEY_OR_LIVE = new Set([
  "live_form",
  "prize_claim_live",
  "process_hosts",
  "client_on_host",
  "pg_compose",
  "art_ground",
  "art_sprites",
  "owner_freeze",
  "contracts",
  "rpc_live",
  "pons_launch",
  "money_form",
  "fee_split",
  "prize_period",
  "prize_basket",
  "basket_conveyor",
  "prize_treasury",
  "vault_safety",
  "prize_surface",
  "launch_freeze",
  "owner_drain",
  "v11_form",
  "districts_live",
  "archetypes_live",
  "research_tree",
  "synergy_buildings",
  "companion_live",
  "companion_revenue",
  "rebalance_close",
])

const HEVM = "0x7109709ecfa91a80626ff3989d68f67f5b1dd12d"
const ZERO = `0x${"00".repeat(20)}`
const PRIVKEY_RE = /0x[0-9a-fA-F]{64}(?![0-9a-fA-F])/g
const ADDR_RE = /0x[0-9a-fA-F]{40}(?![0-9a-fA-F])/g
const SCAN_SKIP = new Set([
  "node_modules",
  "dist",
  "dist-web",
  ".git",
  "cache",
  "out",
  "lib",
  "broadcast",
  "artifacts",
])
const SCAN_SUFFIX = new Set([
  ".ts",
  ".tsx",
  ".js",
  ".jsx",
  ".mjs",
  ".cjs",
  ".sol",
  ".json",
  ".yaml",
  ".yml",
  ".toml",
  ".txt",
  ".sh",
  ".ps1",
  ".env",
])
const SCAN_ROOTS = ["packages", "services", "apps", "deploy", "scripts", "contracts"] as const

type ArchStage = {
  readonly goal: string
  readonly gate_cmd: string
  readonly ts_gate_cmd: string
  readonly tests: readonly string[]
  readonly invariants: readonly string[]
  readonly src: string
  readonly why: string
  readonly construction_tests?: readonly string[]
}

type ArchFile = {
  readonly roadmap_order: readonly string[]
  readonly roadmap: Readonly<Record<string, ArchStage | undefined>>
}

type LaunchFile = {
  readonly deployed: Readonly<Record<string, string | undefined>>
}

type MdcMeta = {
  readonly name: string
  readonly alwaysApply: boolean
  readonly description: string
  readonly body: string
}

function loadArch(): ArchFile {
  return JSON.parse(readFileSync(join(repo, "content/params/arch.json"), "utf8")) as ArchFile
}

function loadLaunch(): LaunchFile {
  return JSON.parse(readFileSync(join(repo, "content/params/launch.json"), "utf8")) as LaunchFile
}

function missingReleaseKeys(arch: ArchFile): readonly string[] {
  const order = new Set(arch.roadmap_order)
  const missing: string[] = []
  for (const id of RELEASE_STAGE_IDS) {
    if (!order.has(id) || arch.roadmap[id] === undefined) missing.push(id)
  }
  return missing
}

function roadmapOrderGaps(arch: ArchFile): readonly string[] {
  const gaps: string[] = []
  if (new Set(arch.roadmap_order).size !== arch.roadmap_order.length) {
    gaps.push("duplicate_order_id")
  }
  const keys = new Set(Object.keys(arch.roadmap))
  const order = new Set(arch.roadmap_order)
  for (const id of keys) {
    if (!order.has(id)) gaps.push(`extra:${id}`)
  }
  for (const id of order) {
    if (!keys.has(id)) gaps.push(`orphan:${id}`)
  }
  return gaps
}

function releaseOrderAfterV11(arch: ArchFile): readonly string[] | "rebalance_close_missing" {
  const i = arch.roadmap_order.indexOf("rebalance_close")
  if (i < 0) return "rebalance_close_missing"
  return arch.roadmap_order.slice(i + 1).filter((id) => !isPictureStage(id))
}

function stageFieldGaps(stage: ArchStage): readonly string[] {
  const gaps: string[] = []
  if (stage.goal.length < 8) gaps.push("goal")
  if (stage.gate_cmd.length < 8) gaps.push("gate_cmd")
  if (stage.ts_gate_cmd.length < 8) gaps.push("ts_gate_cmd")
  if (stage.src.length < 8) gaps.push("src")
  if (stage.why.length < 24) gaps.push("why")
  if (stage.tests.length < 1) gaps.push("tests")
  if (stage.invariants.length < 1) gaps.push("invariants")
  return gaps
}

function parseMdc(name: string, text: string): MdcMeta {
  if (!text.startsWith("---")) {
    return { name, alwaysApply: false, description: "", body: text }
  }
  const end = text.indexOf("\n---", 3)
  if (end < 0) {
    return { name, alwaysApply: false, description: "", body: text }
  }
  const fm = text.slice(3, end)
  const body = text.slice(end + 4)
  const desc = /(?:^|\n)description:\s*(.+)/.exec(fm)
  return {
    name,
    alwaysApply: /^alwaysApply:\s*true\s*$/m.test(fm),
    description: (desc?.[1] ?? "").trim(),
    body,
  }
}

function isPhaseRule(meta: MdcMeta): boolean {
  if (
    meta.name === "code-phase.mdc" ||
    meta.name === "live-phase.mdc" ||
    meta.name === "money-phase.mdc" ||
    meta.name === "v11-phase.mdc" ||
    meta.name === "release-phase.mdc" ||
    meta.name === "visual-phase.mdc"
  ) {
    return true
  }
  return /L0|C0|M0|G0|P0|V0/.test(meta.description) && /фаза/i.test(meta.description)
}

function loadRules(dir: string): readonly MdcMeta[] {
  return readdirSync(dir)
    .filter((name) => name.endsWith(".mdc"))
    .map((name) => parseMdc(name, readFileSync(join(dir, name), "utf8")))
}

function phaseAlwaysNames(rules: readonly MdcMeta[]): readonly string[] {
  return rules.filter((meta) => isPhaseRule(meta) && meta.alwaysApply).map((meta) => meta.name)
}

function allowedAddresses(launch: LaunchFile): ReadonlySet<string> {
  const allowed = new Set<string>([HEVM, ZERO])
  for (const raw of Object.values(launch.deployed)) {
    const n = (raw ?? "").toLowerCase()
    if (n.startsWith("0x") && n.length === 42) allowed.add(n)
  }
  return allowed
}

function keyHits(text: string, allowedAddr: ReadonlySet<string>): readonly string[] {
  const hits: string[] = []
  for (const m of text.matchAll(PRIVKEY_RE)) {
    hits.push(`key:${m[0]}`)
  }
  for (const m of text.matchAll(ADDR_RE)) {
    const n = m[0].toLowerCase()
    if (!allowedAddr.has(n)) hits.push(`addr:${n}`)
  }
  return hits
}

function isScanFile(name: string): boolean {
  const lower = name.toLowerCase()
  if (lower.startsWith(".env")) return true
  if (lower === "dockerfile" || lower === "compose.yaml" || lower === "compose.yml") return true
  const dot = name.lastIndexOf(".")
  if (dot < 0) return false
  return SCAN_SUFFIX.has(name.slice(dot).toLowerCase())
}

function walkScan(relRoot: string): readonly string[] {
  const root = join(repo, relRoot)
  if (!existsSync(root)) return []
  const out: string[] = []
  const stack = [root]
  while (stack.length > 0) {
    const dir = stack.pop()
    if (dir === undefined) continue
    let entries: readonly string[]
    try {
      entries = readdirSync(dir)
    } catch {
      continue
    }
    for (const name of entries) {
      if (SCAN_SKIP.has(name)) continue
      const path = join(dir, name)
      try {
        const st = statSync(path)
        if (st.isDirectory()) {
          stack.push(path)
          continue
        }
        if (!st.isFile() || !isScanFile(name)) continue
        out.push(path)
      } catch {
        continue
      }
    }
  }
  return out
}

function scanRepoKeys(launch: LaunchFile): readonly string[] {
  const allowed = allowedAddresses(launch)
  const found: string[] = []
  for (const rel of SCAN_ROOTS) {
    for (const path of walkScan(rel)) {
      let text: string
      try {
        text = readFileSync(path, "utf8")
      } catch {
        continue
      }
      const hits = keyHits(text, allowed)
      if (hits.length > 0) found.push(`${path}:${hits[0]}`)
    }
  }
  for (const name of [".env", ".env.local", ".env.production", ".env.development"]) {
    const path = join(repo, name)
    if (!existsSync(path)) continue
    let text: string
    try {
      text = readFileSync(path, "utf8")
    } catch {
      continue
    }
    const hits = keyHits(text, allowed)
    if (hits.length > 0) found.push(`${name}:${hits[0]}`)
  }
  return found
}

describe.sequential("P0 construction", () => {
  it("release_stage_keys_exist", () => {
    const arch = loadArch()
    expect(missingReleaseKeys(arch)).toEqual([])
    expect(roadmapOrderGaps(arch)).toEqual([])
    expect(releaseOrderAfterV11(arch)).toEqual([...RELEASE_STAGE_IDS])
    expect(arch.roadmap_order.includes("owner_drain")).toBe(false)
    expect(arch.roadmap["owner_drain"]).toBeUndefined()
    for (const id of RELEASE_STAGE_IDS) {
      expect(V11_OR_MONEY_OR_LIVE.has(id)).toBe(false)
      const stage = arch.roadmap[id]
      expect(stage, id).toBeDefined()
      if (stage === undefined) continue
      expect(stageFieldGaps(stage), id).toEqual([])
      if (id === "release_form") {
        expect(stage.construction_tests ?? []).toEqual([
          "release_stage_keys_exist",
          "no_key_material_in_repo",
        ])
      } else if (id === "player_identity") {
        expect(stage.construction_tests ?? []).toEqual([
          "command_without_session_refused",
          "city_id_comes_from_session",
          "demo_session_has_no_address",
          "identity_absent_from_record_bytes",
          "rate_limit_survives_restart",
        ])
      } else if (id === "ci_tracks") {
        expect(stage.construction_tests ?? []).toEqual([
          "nightly_track_has_full_attack",
          "push_track_has_no_full_attack",
          "workflow_matches_pack_steps",
        ])
      } else if (id === "contract_audit") {
        expect(stage.construction_tests ?? []).toEqual([
          "erc20_return_value_checked",
          "balance_delta_accounting",
          "audit_findings_closed",
        ])
      } else if (id === "prod_image") {
        expect(stage.construction_tests ?? []).toEqual([
          "prod_profile_has_no_source_mount",
          "image_pins_pack_hash",
          "restore_replay_matches_origin",
          "two_replicas_tick_once",
        ])
      } else if (id === "time_rehearsal") {
        expect(stage.construction_tests ?? []).toEqual([
          "rehearsal_pack_hash_equals_prod",
          "farm_window_settles_at_fourteen",
          "prize_period_settles_at_thirty",
          "chain_silence_does_not_block_tick",
        ])
      } else if (id === "ops_watch") {
        expect(stage.construction_tests ?? []).toEqual([
          "metric_observed_is_measured",
          "alert_fires_before_decay_cuts_rate",
          "incident_has_runbook_and_code",
        ])
      } else {
        expect(stage.construction_tests ?? [], id).toEqual([])
      }
    }

    const dir = join(repo, ".cursor/rules")
    expect(existsSync(join(dir, "release-phase.mdc"))).toBe(false)
    const rules = loadRules(dir)
    expect(phaseAlwaysNames(rules)).toEqual(["code-phase.mdc"])
    const phase = rules.find((meta) => meta.name === "code-phase.mdc")
    expect(phase).toBeDefined()
    if (phase === undefined) return
    expect(phase.description.includes("P0")).toBe(true)
    expect(phase.description.includes("P8")).toBe(true)
    expect(phase.body.includes("P0")).toBe(true)
    expect(phase.body.includes("P8")).toBe(true)

    const broken: ArchFile = {
      roadmap_order: arch.roadmap_order.filter((id) => id !== "release_form"),
      roadmap: Object.fromEntries(
        Object.entries(arch.roadmap).filter(([id]) => id !== "release_form"),
      ),
    }
    expect(missingReleaseKeys(broken)).toEqual(["release_form"])
    const brokenOrder: ArchFile = {
      roadmap_order: [...arch.roadmap_order, "release_form"],
      roadmap: arch.roadmap,
    }
    expect(roadmapOrderGaps(brokenOrder)).toEqual(["duplicate_order_id"])
    const form = arch.roadmap["release_form"]
    expect(form).toBeDefined()
    if (form === undefined) return
    const extraKey: ArchFile = {
      roadmap_order: arch.roadmap_order,
      roadmap: { ...arch.roadmap, ghost_stage: form },
    }
    expect(roadmapOrderGaps(extraKey)).toEqual(["extra:ghost_stage"])
    const tenth: ArchFile = {
      roadmap_order: [...arch.roadmap_order, "owner_drain"],
      roadmap: { ...arch.roadmap, owner_drain: form },
    }
    expect(releaseOrderAfterV11(tenth)).not.toEqual([...RELEASE_STAGE_IDS])
    const inserted: ArchFile = {
      roadmap_order: [
        ...arch.roadmap_order.slice(0, arch.roadmap_order.indexOf("ops_watch") + 1),
        "ghost_p",
        ...arch.roadmap_order.slice(arch.roadmap_order.indexOf("ops_watch") + 1),
      ],
      roadmap: { ...arch.roadmap, ghost_p: form },
    }
    expect(releaseOrderAfterV11(inserted)).not.toEqual([...RELEASE_STAGE_IDS])

    const brokenCt: ArchFile = {
      ...arch,
      roadmap: {
        ...arch.roadmap,
        player_identity: {
          ...(arch.roadmap["player_identity"] as ArchStage),
          construction_tests: ["ghost_p1"],
        },
      },
    }
    const emptyP1: ArchFile = {
      ...arch,
      roadmap: {
        ...arch.roadmap,
        player_identity: {
          ...(arch.roadmap["player_identity"] as ArchStage),
          construction_tests: [],
        },
      },
    }
    expect(emptyP1.roadmap["player_identity"]?.construction_tests ?? []).toEqual([])
    expect(brokenCt.roadmap["player_identity"]?.construction_tests).not.toEqual([
      "command_without_session_refused",
      "city_id_comes_from_session",
      "demo_session_has_no_address",
      "identity_absent_from_record_bytes",
      "rate_limit_survives_restart",
    ])

    const ghost: MdcMeta = {
      name: "release-phase.mdc",
      alwaysApply: true,
      description: "Фаза выхода P0–P8",
      body: "",
    }
    expect(isPhaseRule(ghost)).toBe(true)
    expect(phaseAlwaysNames([...rules, ghost])).not.toEqual(["code-phase.mdc"])
  })

  it("no_key_material_in_repo", () => {
    const launch = loadLaunch()
    expect(scanRepoKeys(launch)).toEqual([])
    const planted = "export const k = '0x" + "ab".repeat(32) + "'\n"
    expect(keyHits(planted, allowedAddresses(launch)).length).toBeGreaterThan(0)
    const addr = `export const a = '0x${"11".repeat(20)}'\n`
    expect(keyHits(addr, allowedAddresses(launch)).length).toBeGreaterThan(0)
    const hevm = `Vm(address(uint160(0x7109709ECfa91a80626fF3989D68f67F5b1DD12D)));\n`
    expect(keyHits(hevm, allowedAddresses(launch))).toEqual([])
    const listed = `0x${"11".repeat(20)}`
    const withDeployed: LaunchFile = {
      deployed: { ...launch.deployed, token: listed },
    }
    expect(keyHits(`export const t = '${listed}'\n`, allowedAddresses(withDeployed))).toEqual([])
  })
})
