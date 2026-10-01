import { readdirSync, readFileSync, statSync } from "node:fs"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"
import { createElement } from "react"
import { renderToStaticMarkup } from "react-dom/server"
import { describe, expect, it } from "vitest"
import { loadPack, parseJson, type Json } from "@corporator/contentpack"
import { codes } from "@corporator/protocol"
import { buildHud, emptySnapshot, loadClientPack, loadStringTable } from "../src/index.ts"
import { AgentsScreen } from "../src/hud/screens/agents.tsx"
import { refusalFromIntent } from "../src/hud/parts/refusal.ts"
import type { ScreenProps } from "../src/hud/parts/ScreenFrame.tsx"

const repo = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "..")

function packBytes(): Uint8Array {
  return new Uint8Array(readFileSync(join(repo, "content/out/pack.json")))
}

function readJson(rel: string): Json {
  return parseJson(readFileSync(join(repo, rel), "utf8"))
}

function sourceFiles(dir: string, out: string[]): void {
  for (const name of readdirSync(dir)) {
    const full = join(dir, name)
    if (statSync(full).isDirectory()) sourceFiles(full, out)
    else if (name.endsWith(".ts") || name.endsWith(".tsx")) out.push(full)
  }
}

function propsOf(
  pack: ReturnType<typeof loadClientPack>,
  strings: ReturnType<typeof loadStringTable>,
  extra: Partial<ScreenProps>,
): ScreenProps {
  const view = buildHud({
    pack,
    strings,
    snapshot: extra.view === undefined ? emptySnapshot() : emptySnapshot(),
    nowMs: 0n,
    firstLoginMs: 0n,
    demo: false,
  })
  return {
    view,
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
    ...extra,
  }
}

describe("W16", () => {
  const pack = loadClientPack(loadPack(packBytes()).pack)
  const strings = loadStringTable(readJson("content/strings/en.json"))

  function agentHtml(action: string, code: string): string {
    const view = buildHud({
      pack,
      strings,
      snapshot: {
        ...emptySnapshot(),
        agents: [{ id: "a1", idleKey: "UI_AVAILABLE", role: "engineer" }],
        functions: [
          { id: "workshop", nameKey: "UI_BLD_WORKSHOP", statusKey: "IDLE_NO_AGENT" },
          { id: "robotics_lab", nameKey: "UI_BLD_ROBOTICS_LAB", statusKey: codes.IDLE_UNDER_CONSTRUCTION },
        ],
      },
      nowMs: 0n,
      firstLoginMs: 0n,
      demo: false,
    })
    return renderToStaticMarkup(
      createElement(AgentsScreen, propsOf(pack, strings, { view, commandRefusal: { action, code } })),
    )
  }

  it("draws an assign refusal beside the control", () => {
    const html = agentHtml("assign", codes.IDLE_UNDER_CONSTRUCTION)
    expect(html.includes('data-refusal="IDLE_UNDER_CONSTRUCTION"')).toBe(true)
    expect(html.includes('data-assign-ids="workshop"')).toBe(true)
    expect(html.includes("robotics_lab")).toBe(false)
  })

  it("draws a set_objective refusal beside the control", () => {
    const html = agentHtml("set_objective", codes.API_MALFORMED)
    expect(html.includes('data-refusal="API_MALFORMED"')).toBe(true)
    expect(html.includes('data-action="agent_set_objective"')).toBe(true)
  })

  it("no screen calls onIntent through void", () => {
    const files: string[] = []
    sourceFiles(join(repo, "apps/client/src"), files)
    let hits = 0
    for (const file of files) {
      const text = readFileSync(file, "utf8")
      const found = text.match(/void .*onIntent/g)
      hits += found === null ? 0 : found.length
      if (file.includes(`${join("hud", "screens")}`)) {
        expect(text.includes("void onIntent")).toBe(false)
        expect(text.includes("void screen.onIntent")).toBe(false)
      }
    }
    expect(hits).toBe(0)
  })

  it("a thrown command code is the refusal, and a success clears it", async () => {
    const failed = await refusalFromIntent(
      Promise.resolve({ kind: "failed", code: codes.IDLE_UNDER_CONSTRUCTION }),
    )
    const unavailable = await refusalFromIntent(
      Promise.resolve({ kind: "unavailable", code: codes.API_MALFORMED }),
    )
    const applied = await refusalFromIntent(Promise.resolve({ kind: "applied" }))
    const thrown = await refusalFromIntent(Promise.reject(new Error(codes.IDLE_UNDER_CONSTRUCTION)))
    expect(failed).toBe(codes.IDLE_UNDER_CONSTRUCTION)
    expect(unavailable).toBe(codes.API_MALFORMED)
    expect(applied).toBe("")
    expect(thrown).toBe(codes.IDLE_UNDER_CONSTRUCTION)
  })
})
