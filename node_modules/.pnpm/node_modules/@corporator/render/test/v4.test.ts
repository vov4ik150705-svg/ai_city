import { readFileSync } from "node:fs"
import { execFileSync } from "node:child_process"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"
import { describe, expect, it } from "vitest"
import { loadScene } from "../src/ground.ts"
import { frontVertex, tileCubeH } from "../src/iso.ts"
import {
  badgeKind,
  badgeOnScene,
  badgeSprite,
  labelsVisible,
  objectIdle,
  overlayAt,
  sceneMarkers,
  sortPlaced,
  spriteScreenPos,
  type BadgeRow,
  type OverlayRow,
  type SpriteFrame,
} from "../src/sprites.ts"

const repo = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "..")
const python = process.env["PYTHON"] ?? "python"

function runPython(script: string): string {
  return execFileSync(python, ["-c", script], { cwd: repo, encoding: "utf8" })
}

type PackFile = {
  readonly generated?: {
    readonly placement?: {
      readonly scene?: unknown
      readonly level_overlays?: {
        readonly [lv: string]: {
          readonly pips?: number
          readonly antenna?: number
          readonly sprite_id_depends_on_level?: number
        }
      }
      readonly scene_badges?: readonly {
        readonly code?: string
        readonly kind?: string
        readonly log_only?: number
      }[]
    }
  }
  readonly sections?: {
    readonly render?: {
      readonly params?: {
        readonly label_min_zoom_num?: { readonly v?: number }
        readonly label_min_zoom_den?: { readonly v?: number }
      }
    }
  }
}

type AtlasFile = {
  readonly tile_w?: number
  readonly frames?: {
    readonly [id: string]: {
      readonly w?: number
      readonly h?: number
      readonly foot_anchor?: readonly number[]
      readonly footprint?: readonly number[]
      readonly kind?: string
    }
  }
}

function loadFrames(): { readonly [id: string]: SpriteFrame } {
  const man = JSON.parse(readFileSync(join(repo, "content/out/atlas/city.json"), "utf8")) as AtlasFile
  const out: { [id: string]: SpriteFrame } = {}
  const frames = man.frames ?? {}
  for (const id of Object.keys(frames)) {
    const fr = frames[id]
    if (fr === undefined) continue
    const fa = fr.foot_anchor ?? []
    const fp = fr.footprint ?? []
    out[id] = {
      footX: BigInt(fa[0] ?? 0),
      footY: BigInt(fa[1] ?? 0),
      cols: BigInt(fp[0] ?? 1),
      rows: BigInt(fp[1] ?? 1),
      kind: fr.kind ?? "",
      w: BigInt(fr.w ?? 0),
      h: BigInt(fr.h ?? 0),
    }
  }
  return out
}

describe.sequential("V4 construction", () => {
  it("sprite_sits_on_foot_anchor", () => {
    const pack = JSON.parse(readFileSync(join(repo, "content/out/pack.json"), "utf8")) as PackFile
    const scene = loadScene(pack.generated?.placement?.scene)
    const frames = loadFrames()
    const hall = scene.objects.find((o) => o.id === "city_hall")
    expect(hall).toBeDefined()
    if (hall === undefined) return
    const fr = frames["city_hall"]
    expect(fr).toBeDefined()
    if (fr === undefined) return
    const man = JSON.parse(readFileSync(join(repo, "content/out/atlas/city.json"), "utf8")) as AtlasFile
    const tileW = BigInt(man.tile_w ?? 0)
    const cubeH = tileCubeH(tileW)
    const got = spriteScreenPos(
      hall.tileX,
      hall.tileY,
      fr.cols,
      fr.rows,
      tileW,
      cubeH,
      fr.footX,
      fr.footY,
      0n,
    )
    const py = runPython(
      "import json\nfrom pathlib import Path\n"
      + "import sys\nsys.path.insert(0, 'art/pipeline')\nimport scene\n"
      + "pack = json.loads(Path('content/out/pack.json').read_text(encoding='utf-8'))\n"
      + "man = json.loads(Path('content/out/atlas/city.json').read_text(encoding='utf-8'))\n"
      + "obj = next(o for o in pack['generated']['placement']['scene']['objects'] if o['id']=='city_hall')\n"
      + "tx, ty = obj['tile']\n"
      + "fr = man['frames']['city_hall']\n"
      + "cols, rows = fr['footprint']\n"
      + "fx, fy = scene.front_vertex(tx, ty, cols, rows)\n"
      + "ax, ay = fr['foot_anchor']\n"
      + "drop = 0\n"
      + "print('%d %d' % (fx - ax, fy - ay - drop))\n"
      + "print('%d %d' % scene.front_vertex(tx, ty, cols, rows))\n",
    )
    const lines = py.trim().split(/\r?\n/)
    const pos = (lines[0] ?? "").split(" ")
    expect(got.x.toString()).toBe(pos[0])
    expect(got.y.toString()).toBe(pos[1])
    const front = frontVertex(hall.tileX, hall.tileY, fr.cols, fr.rows, tileW)
    const fv = (lines[1] ?? "").split(" ")
    expect(front.x.toString()).toBe(fv[0])
    expect(front.y.toString()).toBe(fv[1])
  })

  it("painter_order_matches_python", () => {
    const pack = JSON.parse(readFileSync(join(repo, "content/out/pack.json"), "utf8")) as PackFile
    const scene = loadScene(pack.generated?.placement?.scene)
    const frames = loadFrames()
    const got = sortPlaced(scene.objects, frames).map((row) => row.id)
    const py = runPython(
      "import json\nfrom pathlib import Path\n"
      + "pack = json.loads(Path('content/out/pack.json').read_text(encoding='utf-8'))\n"
      + "man = json.loads(Path('content/out/atlas/city.json').read_text(encoding='utf-8'))\n"
      + "frames = man['frames']\n"
      + "placed = []\n"
      + "for obj in pack['generated']['placement']['scene']['objects']:\n"
      + "    sid = obj['id']\n"
      + "    fr = frames.get(sid)\n"
      + "    if not fr: continue\n"
      + "    tx, ty = obj['tile']\n"
      + "    cols, rows = fr['footprint']\n"
      + "    placed.append(((tx + cols - 1) + (ty + rows - 1), tx, sid))\n"
      + "placed.sort(key=lambda o: (o[0], o[1]))\n"
      + "print('\\n'.join(p[2] for p in placed))\n",
    )
    const want = py.trim().split(/\r?\n/).filter((line) => line.length > 0)
    expect(got.length).toBe(want.length)
    expect(got).toEqual(want)
  })

  it("level_overlay_from_pack", () => {
    const pack = JSON.parse(readFileSync(join(repo, "content/out/pack.json"), "utf8")) as PackFile
    const raw = pack.generated?.placement?.level_overlays ?? {}
    const rows: { [lv: string]: OverlayRow } = {}
    for (const lv of Object.keys(raw)) {
      const spec = raw[lv]
      if (spec === undefined) continue
      rows[lv] = {
        pips: BigInt(spec.pips ?? 0),
        antenna: BigInt(spec.antenna ?? 0),
        depends: BigInt(spec.sprite_id_depends_on_level ?? 0),
      }
    }
    expect(overlayAt(1n, rows).pips).toBe(0n)
    expect(overlayAt(1n, rows).antenna).toBe(0n)
    const two = 1n + 1n
    expect(overlayAt(1n + two, rows).pips).toBe(two)
    expect(overlayAt(1n + two, rows).antenna).toBe(1n)
    expect(overlayAt(1n + two, rows).depends).toBe(0n)
  })

  it("shortage_badge_on_scene", () => {
    const pack = JSON.parse(readFileSync(join(repo, "content/out/pack.json"), "utf8")) as PackFile
    const badges: BadgeRow[] = (pack.generated?.placement?.scene_badges ?? []).map((row) => ({
      code: row.code ?? "",
      kind: row.kind ?? "",
      logOnly: BigInt(row.log_only ?? 1),
    }))
    expect(badgeKind("IDLE_NO_ENERGY")).toBe("shortage")
    expect(badgeSprite("shortage")).toBe("badge_shortage")
    expect(badgeOnScene("IDLE_NO_ENERGY", badges)).toBe(true)
    const frames = loadFrames()
    expect(frames["badge_shortage"]).toBeDefined()
    const scene = loadScene(pack.generated?.placement?.scene)
    const shown = sceneMarkers(scene.objects, frames, 0n, 1n, badges)
    expect(shown.some((m) => m.sprite === "badge_shortage")).toBe(true)
    const hidden = sceneMarkers(scene.objects, frames, 1n, 1n, badges)
    expect(hidden.some((m) => m.sprite === "badge_shortage")).toBe(false)
    expect(objectIdle("building", 0n, 1n)).toBe("IDLE_NO_ENERGY")
    expect(objectIdle("decor", 0n, 1n)).toBe("")
    const num = BigInt(pack.sections?.render?.params?.label_min_zoom_num?.v ?? 0)
    const den = BigInt(pack.sections?.render?.params?.label_min_zoom_den?.v ?? 0)
    expect(labelsVisible(1n, den * (1n + 1n), num, den)).toBe(false)
    expect(labelsVisible(num, den, num, den)).toBe(true)
    expect(labelsVisible(1n, 1n, 0n, den)).toBe(false)
  })
})
