import { existsSync, readFileSync } from "node:fs"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"
import { createElement } from "react"
import { renderToStaticMarkup } from "react-dom/server"
import { describe, expect, it } from "vitest"
import { buildings } from "@corporator/protocol"
import { HUD_CHROME } from "../src/palette.ts"
import { BuildingCard } from "../src/hud/parts/BuildingCard.tsx"
import { BuildingThumbnail } from "../src/hud/parts/BuildingThumbnail.tsx"
import { ResearchCard } from "../src/hud/parts/ResearchCard.tsx"
import { HudIcon, HUD_ICON_NAME, HUD_LUCIDE, hudIconName } from "../src/hud/parts/HudIcon.tsx"
import { groupThousands } from "../src/hud/studio/EconomyLook.tsx"
import {
  AGENT_ROLE_IDS,
  BUILDING_ART_DIR,
  BUILDING_SHEET_FILES,
  BUILDING_THUMB_FILES,
  BRAND_UNIT_FILES,
  DECORATIVE_BUILDING_FILE,
  DECORATIVE_BUILDING_ID,
  FUNCTIONAL_BUILDING_IDS,
  UNIT_ART_DIR,
  ROLE_PORTRAIT_DIR,
  UNIT_SHEET_FILE,
  buildingCardKind,
  resolveBuildingArt,
  resolveRolePortrait,
} from "../src/hud/parts/hudArt.ts"

const repo = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "..")
const client = join(repo, "apps/client")

function markup(node: ReturnType<typeof createElement>): string {
  return renderToStaticMarkup(node)
}

describe("HUD visual system", () => {
  it("keeps Desktop v1.1 bright-blue tokens in palette and CSS", () => {
    const css = readFileSync(join(client, "src/hud/hud.css"), "utf8")
    expect(HUD_CHROME.blue).toBe("#245A9A")
    expect(HUD_CHROME.blueDark).toBe("#1D4B86")
    expect(HUD_CHROME.blueLight).toBe("#2E68AA")
    expect(HUD_CHROME.gradientTop).toBe("#2C67AA")
    expect(HUD_CHROME.gradientBottom).toBe("#1E4F8C")
    expect(HUD_CHROME.textPrimary).toBe("#F4F7FA")
    expect(HUD_CHROME.textSecondary).toBe("#C7D5E3")
    expect(HUD_CHROME.textMuted).toBe("#8FA8C0")
    expect(HUD_CHROME.interaction).toBe("#45C7F4")
    expect(HUD_CHROME.selected).toBe("#FFB64A")
    expect(HUD_CHROME.success).toBe("#63D68A")
    expect(HUD_CHROME.warning).toBe("#F0B85B")
    expect(HUD_CHROME.error).toBe("#E97878")
    for (const hex of Object.values(HUD_CHROME)) {
      expect(css.includes(hex)).toBe(true)
    }
    expect(css.includes("linear-gradient(180deg, #2C67AA 0%, #1E4F8C 100%)")).toBe(true)
    expect(css.includes(".hud-btn--primary")).toBe(true)
    expect(css.includes(".hud-btn--secondary")).toBe(true)
    expect(css.includes(".hud-btn--ghost")).toBe(true)
    expect(css.includes("--hud-radius-small: 8px")).toBe(true)
    expect(css.includes("--hud-radius-medium: 12px")).toBe(true)
    expect(css.includes("--hud-radius-large: 16px")).toBe(true)
    expect(css.includes("--hud-size-caption: 0.75rem")).toBe(true)
    expect(css.includes("--hud-size-display: 2.25rem")).toBe(true)
    expect(css.includes("#071522")).toBe(false)
    expect(css.includes("Source Serif 4")).toBe(false)
    const html = readFileSync(join(client, "hud-panels.html"), "utf8")
    const boot = readFileSync(join(client, "src/hudStudio.tsx"), "utf8")
    const studio = readFileSync(join(client, "src/hud/studio/PanelStudio.tsx"), "utf8")
    const studioCss = readFileSync(join(client, "src/hud/studio/hud-studio.css"), "utf8")
    const eco = readFileSync(join(client, "src/hud/studio/EconomyLook.tsx"), "utf8")
    expect(html.includes("/src/hudStudio.tsx")).toBe(true)
    expect(html.includes("hudPreview")).toBe(false)
    for (const src of [boot, studio, eco]) {
      expect(src.includes("SceneHost")).toBe(false)
      expect(src.includes("IslandScene")).toBe(false)
      expect(src.includes("three")).toBe(false)
      expect(src.includes("hud/App")).toBe(false)
      expect(src.includes("124,800")).toBe(false)
      expect(src.includes("124800")).toBe(false)
    }
    expect(studioCss.includes("overflow-x: auto")).toBe(false)
    expect(eco.includes("hud-economy__meter")).toBe(true)
    expect(eco.includes("hud-economy__res")).toBe(true)
    expect(eco.slice(eco.indexOf("function ResourceLine")).includes("<Progress")).toBe(false)
    expect(boot.includes("buildHud")).toBe(true)
    expect(boot.includes("loadHudPreviewAssets")).toBe(true)
    expect(groupThousands("0")).toBe("0")
    expect(groupThousands("12")).toBe("12")
    expect(groupThousands("1234")).toBe("1,234")
    expect(groupThousands("-1240")).toBe("-1,240")
  })

  it("resolves local building thumbs and excludes the decorative 19th plus sheets", () => {
    expect([...FUNCTIONAL_BUILDING_IDS].sort()).toEqual(Object.keys(buildings).sort())
    expect(Object.keys(BUILDING_THUMB_FILES).sort()).toEqual(Object.keys(buildings).sort())
    expect(DECORATIVE_BUILDING_ID in BUILDING_THUMB_FILES).toBe(false)
    expect(resolveBuildingArt("bank").kind).toBe("functional")
    expect(resolveBuildingArt("bank").file).toBe("Bank.png")
    expect(resolveBuildingArt("City Hall.png").kind).toBe("functional")
    expect(resolveBuildingArt("neon_residence").kind).toBe("decorative")
    expect(resolveBuildingArt("Neon Residence.png").file).toBe(DECORATIVE_BUILDING_FILE)
    expect(resolveBuildingArt("unknown_tower").kind).toBe("unavailable")
    expect(resolveBuildingArt("").kind).toBe("unavailable")
    expect(buildingCardKind("bank")).toBe("functional")
    expect(buildingCardKind("neon_residence")).toBe("decorative")
    expect(buildingCardKind("unknown_tower")).toBe("unavailable")
    expect(buildingCardKind("Canonical_Building_Reference_11_19.png")).toBe("unavailable")
    for (const sheet of BUILDING_SHEET_FILES) {
      expect(resolveBuildingArt(sheet).kind).toBe("sheet")
    }
    const orig = join(repo, BUILDING_ART_DIR)
    expect(existsSync(join(orig, BUILDING_THUMB_FILES.bank))).toBe(true)
    expect(existsSync(join(orig, DECORATIVE_BUILDING_FILE))).toBe(true)
    for (const sheet of BUILDING_SHEET_FILES) {
      expect(existsSync(join(orig, sheet))).toBe(true)
    }
    const card = readFileSync(join(client, "src/hud/parts/BuildingCard.tsx"), "utf8")
    expect(card.includes("BuildingThumbnail")).toBe(true)
    expect(card.includes(DECORATIVE_BUILDING_ID)).toBe(false)
    expect(card.includes("Neon Residence")).toBe(false)
  })

  it("resolves role portraits and keeps sheets/brand as non-agent fallbacks", () => {
    expect(resolveRolePortrait("engineer").kind).toBe("ready")
    expect(resolveRolePortrait("engineer").file).toBe("Engineer_anfas.png")
    expect(resolveRolePortrait("engineer", "icon").file).toBe("Engineer_icon.png")
    expect(resolveRolePortrait(undefined).kind).toBe("unavailable")
    expect(resolveRolePortrait("").kind).toBe("unavailable")
    expect(resolveRolePortrait("mayor").kind).toBe("unavailable")
    expect(resolveRolePortrait("unit_roster_5_originals").kind).toBe("sheet")
    expect(resolveRolePortrait("corporator").kind).toBe("brand")
    const units = join(repo, UNIT_ART_DIR)
    const portraits = join(repo, ROLE_PORTRAIT_DIR)
    expect(existsSync(join(units, UNIT_SHEET_FILE))).toBe(true)
    for (const role of AGENT_ROLE_IDS) {
      expect(existsSync(join(portraits, resolveRolePortrait(role).file))).toBe(true)
      expect(existsSync(join(units, resolveRolePortrait(role, "icon").file))).toBe(true)
    }
    for (const file of BRAND_UNIT_FILES) {
      expect(existsSync(join(units, file))).toBe(true)
    }
  })

  it("documents Lucide registry names and accessible labels without a Settings destination", () => {
    const glyphs = Object.keys(HUD_LUCIDE)
    expect(glyphs.length).toBe(Object.keys(HUD_ICON_NAME).length)
    for (const glyph of glyphs) {
      const name = HUD_ICON_NAME[glyph as keyof typeof HUD_ICON_NAME]
      expect(name.length > 0).toBe(true)
      expect(hudIconName(glyph as keyof typeof HUD_ICON_NAME)).toBe(name)
    }
    expect(HUD_LUCIDE.wallet).toBe("WalletCards")
    expect(HUD_LUCIDE.plus).toBe("Plus")
    expect(HUD_LUCIDE.go).toBe("ArrowUpRight")
    expect(HUD_LUCIDE.gear).toBe("Settings")
    expect(HUD_LUCIDE.help).toBe("CircleHelp")
    expect(HUD_LUCIDE.building).toBe("Building2")
    expect(HUD_LUCIDE.tier).toBe("Layers3")
    expect(HUD_ICON_NAME.close).toBe("Close")
    const named = markup(createElement(HudIcon, { glyph: "close", named: true }))
    expect(named.includes("aria-label=\"Close\"")).toBe(true)
    expect(named.includes("aria-hidden=\"true\"")).toBe(false)
    const hidden = markup(createElement(HudIcon, { glyph: "close" }))
    expect(hidden.includes("aria-hidden=\"true\"")).toBe(true)
    const app = readFileSync(join(client, "src/hud/App.tsx"), "utf8")
    expect(app.includes("onNavigate(\"settings\")")).toBe(false)
    expect(app.includes("BottomNav")).toBe(false)
  })

  it("loads verified local IBM Plex Sans and JetBrains Mono without a CDN", () => {
    const faces = readFileSync(join(client, "src/hud/parts/FontFaces.tsx"), "utf8")
    const man = JSON.parse(readFileSync(join(repo, "art/fonts/manifest.json"), "utf8")) as {
      readonly pixel: { readonly file: string; readonly family: string; readonly license_file: string }
      readonly log: { readonly file: string; readonly family: string; readonly license_file: string }
    }
    expect(man.pixel.family).toBe("IBM Plex Sans")
    expect(man.pixel.file).toBe("ibm_plex_sans.woff2")
    expect(man.log.family).toBe("JetBrains Mono")
    expect(man.log.file).toBe("jetbrains_mono.woff2")
    expect(faces.includes("ibm_plex_sans.woff2")).toBe(true)
    expect(faces.includes("jetbrains_mono.woff2")).toBe(true)
    expect(faces.includes("fonts.googleapis")).toBe(false)
    expect(faces.includes("source_serif_4.woff2")).toBe(false)
    const plex = join(repo, "art/fonts", man.pixel.file)
    const mono = join(repo, "art/fonts", man.log.file)
    expect(existsSync(plex)).toBe(true)
    expect(existsSync(mono)).toBe(true)
    expect(existsSync(join(repo, "art/fonts", man.pixel.license_file))).toBe(true)
    expect(existsSync(join(repo, "art/fonts", man.log.license_file))).toBe(true)
    expect(readFileSync(plex).subarray(0, 4).toString("ascii")).toBe("wOF2")
    expect(readFileSync(mono).subarray(0, 4).toString("ascii")).toBe("wOF2")
    const pack = JSON.parse(readFileSync(join(repo, "content/out/pack.json"), "utf8")) as {
      readonly generated: { readonly render: { readonly [key: string]: string } }
    }
    const render = pack.generated.render
    expect(render["hud_font_pixel_family"]).toBe("IBM Plex Sans")
    expect(render["hud_font_pixel_file"]).toBe("ibm_plex_sans.woff2")
    expect(render["hud_font_log_family"]).toBe("JetBrains Mono")
    expect(render["hud_font_log_file"]).toBe("jetbrains_mono.woff2")
    expect(render["hud_font_pixel_family"]).not.toBe("Source Serif 4")
    expect(render["hud_font_pixel_file"]).not.toBe("source_serif_4.woff2")
  })

  it("refuses decorative and unknown IDs as a functional BuildingCard thumbnail", () => {
    const bank = markup(
      createElement(BuildingCard, {
        buildingId: "bank",
        title: "Bank",
        titleKey: "UI_BLD_BANK",
        ticker: "COIN",
        districtId: "finance",
        mapped: true,
        decorative: "No economic function. Not in the pack.",
        statusLabel: "Status",
        statusText: "Open",
        statusKey: "UI_OPEN",
        missingStatus: false,
        manageLabel: "Manage",
        unmapped: "Decorative building",
        unavailable: "Unavailable",
        facts: [],
        onManage: () => {},
      }),
    )
    expect(bank.includes('data-card="functional"')).toBe(true)
    expect(bank.includes('data-thumb="ready"')).toBe(true)
    expect(bank.includes("data-key=\"UI_MANAGE\"")).toBe(true)
    const neon = markup(
      createElement(BuildingCard, {
        buildingId: DECORATIVE_BUILDING_ID,
        title: DECORATIVE_BUILDING_ID,
        titleKey: "UI_UNMAPPED_BUILDING",
        ticker: "COIN",
        districtId: "finance",
        mapped: false,
        decorative: "No economic function. Not in the pack.",
        statusLabel: "Status",
        statusText: "Open",
        statusKey: "UI_OPEN",
        missingStatus: false,
        manageLabel: "Manage",
        unmapped: "Decorative building",
        unavailable: "Unavailable",
        facts: [{ label: "Level", labelKey: "UI_BUILDING_LEVEL", value: "3", valueKey: "UI_BUILDING_LEVEL", missing: false }],
        onManage: () => {},
      }),
    )
    expect(neon.includes('data-card="decorative"')).toBe(true)
    expect(neon.includes('data-thumb="ready"')).toBe(false)
    expect(neon.includes('data-thumb="decorative"')).toBe(true)
    expect(neon.includes('data-thumb="icon"')).toBe(false)
    expect(neon.includes("hud-thumb__img")).toBe(false)
    expect(neon.includes("data-key=\"UI_MANAGE\"")).toBe(false)
    expect(neon.includes("data-key=\"UI_DECORATIVE\"")).toBe(true)
    expect(neon.includes("data-key=\"UI_BUILDING_LEVEL\"")).toBe(false)
    const unknown = markup(
      createElement(BuildingCard, {
        buildingId: "unknown_tower",
        title: "unknown_tower",
        titleKey: "UI_UNMAPPED_BUILDING",
        ticker: "NVDA",
        districtId: "compute",
        mapped: false,
        decorative: "No economic function. Not in the pack.",
        statusLabel: "Status",
        statusText: "Open",
        statusKey: "UI_OPEN",
        missingStatus: false,
        manageLabel: "Manage",
        unmapped: "Decorative building",
        unavailable: "Unavailable",
        facts: [{ label: "Level", labelKey: "UI_BUILDING_LEVEL", value: "3", valueKey: "UI_BUILDING_LEVEL", missing: false }],
        onManage: () => {},
      }),
    )
    expect(unknown.includes('data-card="unavailable"')).toBe(true)
    expect(unknown.includes('data-thumb="ready"')).toBe(false)
    expect(unknown.includes('data-thumb="icon"')).toBe(false)
    expect(unknown.includes("hud-thumb__img")).toBe(false)
    expect(unknown.includes("data-key=\"UI_MANAGE\"")).toBe(false)
    expect(unknown.includes("data-key=\"UI_UNAVAILABLE\"")).toBe(true)
    expect(unknown.includes("data-key=\"UI_BUILDING_LEVEL\"")).toBe(false)
    const sheet = markup(
      createElement(BuildingThumbnail, {
        buildingId: BUILDING_SHEET_FILES[0] ?? "Canonical_Building_Reference_11_19.png",
        unavailable: "Unavailable",
        fallbackIcon: true,
      }),
    )
    expect(sheet.includes('data-thumb="ready"')).toBe(false)
    expect(sheet.includes("hud-thumb__img")).toBe(false)
    expect(sheet.includes('data-thumb="unavailable"')).toBe(true)
  })

  it("keeps ResearchCard artwork explicit unavailable without invented assets", () => {
    const card = markup(
      createElement(ResearchCard, {
        axisId: "output",
        name: "Output",
        nameKey: "UI_AXIS_OUTPUT",
        cost: 1n,
        timeTicks: 1n,
        costLabel: "Cost",
        durationLabel: "Duration",
        unavailable: "Unavailable",
      }),
    )
    expect(card.includes('data-art="unavailable"')).toBe(true)
    expect(card.includes("hud-thumb__img")).toBe(false)
    expect(readFileSync(join(client, "src/hud/screens/registry.ts"), "utf8").includes("SettingsScreen")).toBe(true)
  })
})
