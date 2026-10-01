/**
 * Cinematic stills of the live Terra island from the client preview.
 * Offsets are from the owner-accepted look camera, not random orbit.
 */
import { existsSync, mkdirSync, readFileSync, unlinkSync, writeFileSync } from "node:fs"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"
import { createRequire } from "node:module"

const here = dirname(fileURLToPath(import.meta.url))
const argv = process.argv.slice(2)
const MASTER = argv.includes("--master")
const SITE_HERO = argv.includes("--site-hero")
const WALK_RIGHT_LOW = argv.includes("--walk-right-low")
const onlyIds = argv
  .filter((token) => !token.startsWith("--"))
  .flatMap((token) => token.split(",").map((part) => part.trim()).filter(Boolean))
const outDir = join(
  here,
  SITE_HERO ? "island_site_hero" : WALK_RIGHT_LOW ? "island_walk_right_low" : MASTER ? "island_master" : "island",
)
const require = createRequire(join(here, "capture_island_shots.mjs"))
const { chromium } = require(join(here, "..", "..", ".tmp-marketing-site", "node_modules", "playwright"))

const PREVIEW = "http://127.0.0.1:5176/preview.html?capture=1"
const VIEW_W = MASTER ? 3840 : 1920
const VIEW_H = MASTER ? 2160 : 1080

/** @typedef {{ id: string, dAz: number, dEl: number, distMul: number, why: string }} Shot */

/**
 * Site mockup face: Coinbase left, City Hall, Microsoft, NVIDIA right.
 * Dist stays in a band where 4K still reads signs; no jewel/crop extremes.
 * @type {readonly Shot[]}
 */
const SITE_HERO_SHOTS = [
  { id: "01_match", dAz: -18, dEl: 1, distMul: 1.04, why: "site mockup match" },
  { id: "02_closer", dAz: -18, dEl: 1, distMul: 0.92, why: "same face, signs larger" },
  { id: "03_tight", dAz: -18, dEl: 2, distMul: 0.82, why: "signs fill, island whole" },
  { id: "04_near", dAz: -18, dEl: 1, distMul: 0.96, why: "hair closer than match" },
  { id: "05_pull", dAz: -18, dEl: 0, distMul: 1.16, why: "more sky" },
  { id: "06_banner", dAz: -18, dEl: -1, distMul: 1.28, why: "banner air around mass" },
  { id: "07_yaw_in", dAz: -14, dEl: 1, distMul: 1.04, why: "yaw +4" },
  { id: "08_yaw_out", dAz: -22, dEl: 1, distMul: 1.04, why: "yaw -4" },
  { id: "09_yaw_in2", dAz: -12, dEl: 1, distMul: 1.0, why: "yaw +6" },
  { id: "10_yaw_out2", dAz: -24, dEl: 1, distMul: 1.0, why: "yaw -6" },
  { id: "11_low", dAz: -18, dEl: -3, distMul: 1.08, why: "lower, more cliff" },
  { id: "12_lower", dAz: -18, dEl: -5, distMul: 1.12, why: "lower cliff and falls" },
  { id: "13_high", dAz: -18, dEl: 4, distMul: 1.04, why: "slightly higher roofs" },
  { id: "14_high2", dAz: -18, dEl: 6, distMul: 1.1, why: "more roof, signs up" },
  { id: "15_close_low", dAz: -18, dEl: -2, distMul: 0.9, why: "closer + lower" },
  { id: "16_close_high", dAz: -18, dEl: 3, distMul: 0.88, why: "closer + higher" },
  { id: "17_yaw_close", dAz: -16, dEl: 2, distMul: 0.9, why: "yaw in, signs large" },
  { id: "18_yaw_close_out", dAz: -20, dEl: 2, distMul: 0.9, why: "yaw out, signs large" },
  { id: "19_banner_low", dAz: -18, dEl: -4, distMul: 1.22, why: "banner, low mass" },
  { id: "20_match_fill", dAz: -17, dEl: 0, distMul: 1.0, why: "match + hair closer" },
]

/**
 * Same face as 05_hero_walk_right, camera stepped down.
 * Original dEl is +1 (~28.8°). Do not overwrite island_master.
 * @type {readonly Shot[]}
 */
const WALK_RIGHT_LOW_SHOTS = [
  { id: "01_low", dAz: 18, dEl: -2, distMul: 1.04, why: "walk-right, 3° lower" },
  { id: "02_lower", dAz: 18, dEl: -4, distMul: 1.04, why: "walk-right, 5° lower" },
  { id: "03_lowest", dAz: 18, dEl: -6, distMul: 1.04, why: "walk-right, 7° lower" },
  { id: "04_lowest_near", dAz: 18, dEl: -6, distMul: 0.86, why: "03_lowest closer" },
  { id: "05_lowest_closer", dAz: 18, dEl: -6, distMul: 0.74, why: "03_lowest, banner fill" },
  { id: "06_lowest_fill", dAz: 18, dEl: -6, distMul: 0.64, why: "03_lowest, tight fill" },
]

/** @type {readonly Shot[]} */
const DEFAULT_SHOTS = [
  { id: "01_hero", dAz: 0, dEl: 0, distMul: 1, why: "accepted postcard" },
  { id: "02_hero_wide", dAz: -4, dEl: -2, distMul: 1.42, why: "establishing: more sky and cliff" },
  { id: "03_hero_tight", dAz: 3, dEl: 4, distMul: 0.7, why: "civic core fills the frame" },
  { id: "04_hero_walk_left", dAz: -18, dEl: 1, distMul: 1.04, why: "hero variant, step left" },
  { id: "05_hero_walk_right", dAz: 18, dEl: 1, distMul: 1.04, why: "hero variant, step right" },
  { id: "06_threequarter_left", dAz: -46, dEl: 1, distMul: 1.08, why: "readable 3/4 left" },
  { id: "07_threequarter_right", dAz: 50, dEl: 1, distMul: 1.08, why: "readable 3/4 right" },
  { id: "08_beauty_left_high", dAz: -40, dEl: 8, distMul: 1.12, why: "rooflines, 3/4 high left" },
  { id: "09_beauty_right_low", dAz: 42, dEl: -8, distMul: 1.22, why: "mass + city, 3/4 low right" },
  { id: "10_opposite", dAz: 178, dEl: 3, distMul: 1.12, why: "second establishing face" },
  { id: "11_opposite_wide", dAz: 168, dEl: -1, distMul: 1.38, why: "reverse poster" },
  { id: "12_high_aerial", dAz: 10, dEl: 24, distMul: 1.32, why: "city plan, not map-top" },
  { id: "13_drone_high", dAz: 8, dEl: 14, distMul: 1.15, why: "architectural drone" },
  { id: "14_low_cliff", dAz: -8, dEl: -16, distMul: 1.36, why: "floating mass vs sky" },
  { id: "15_poster_sky", dAz: -6, dEl: -10, distMul: 1.58, why: "sky room for type" },
  { id: "16_profile_east", dAz: 92, dEl: -3, distMul: 1.2, why: "silhouette" },
  { id: "17_profile_west", dAz: -78, dEl: -2, distMul: 1.05, why: "silhouette reverse" },
  { id: "18_rim_waterfall", dAz: 132, dEl: -6, distMul: 1.18, why: "waterfall rim in foreground" },
  { id: "19_civic_approach", dAz: 6, dEl: 7, distMul: 0.84, why: "approach to City Hall" },
  { id: "20_intimate_square", dAz: 2, dEl: 5, distMul: 0.58, why: "close civic square" },
  { id: "21_southwest_3q", dAz: -135, dEl: 2, distMul: 1.14, why: "SW three-quarter" },
  { id: "22_southeast_3q", dAz: 135, dEl: 2, distMul: 1.14, why: "SE three-quarter" },
  { id: "23_cliff_threequarter", dAz: -28, dEl: -12, distMul: 1.28, why: "cliff in frame, city beyond" },
  { id: "24_north_establishing", dAz: 160, dEl: 6, distMul: 1.2, why: "north establishing" },
  // Same family as 04_hero_walk_left: Coinbase-left civic 3/4. Zoom + slight tilt.
  { id: "25_walkleft_close_fill", dAz: -18, dEl: 3, distMul: 0.46, why: "walk-left, buildings fill" },
  { id: "26_walkleft_close", dAz: -18, dEl: 2, distMul: 0.58, why: "walk-left, close civic" },
  { id: "27_walkleft_near", dAz: -18, dEl: 1, distMul: 0.72, why: "walk-left, near" },
  { id: "28_walkleft_medium", dAz: -18, dEl: 1, distMul: 0.88, why: "walk-left, medium" },
  { id: "29_walkleft_pull", dAz: -18, dEl: 0, distMul: 1.22, why: "walk-left, pull back" },
  { id: "30_walkleft_wide", dAz: -18, dEl: -1, distMul: 1.42, why: "walk-left, establishing" },
  { id: "31_walkleft_poster", dAz: -18, dEl: -3, distMul: 1.68, why: "walk-left, poster sky" },
  { id: "32_walkleft_jewel", dAz: -18, dEl: -4, distMul: 1.95, why: "walk-left, floating jewel" },
  { id: "33_walkleft_low_close", dAz: -18, dEl: -10, distMul: 0.78, why: "walk-left, cliff FG close" },
  { id: "34_walkleft_low_wide", dAz: -18, dEl: -14, distMul: 1.32, why: "walk-left, low cliff wide" },
  { id: "35_walkleft_drone", dAz: -18, dEl: 12, distMul: 0.92, why: "walk-left, architectural drone" },
  { id: "36_walkleft_high_wide", dAz: -18, dEl: 18, distMul: 1.38, why: "walk-left, high establishing" },
  { id: "37_walkleft_yaw_in", dAz: -10, dEl: 2, distMul: 0.6, why: "walk-left +8°, close" },
  { id: "38_walkleft_yaw_out", dAz: -26, dEl: 0, distMul: 1.5, why: "walk-left -8°, wide" },
  { id: "39_walkleft_yaw_low", dAz: -24, dEl: -12, distMul: 1.16, why: "walk-left yaw, low mass" },
  { id: "40_walkleft_intimate", dAz: -16, dEl: 5, distMul: 0.5, why: "walk-left, intimate square" },
]

const SHOTS = SITE_HERO ? SITE_HERO_SHOTS : WALK_RIGHT_LOW ? WALK_RIGHT_LOW_SHOTS : DEFAULT_SHOTS

function wrapAz(deg) {
  const turn = 360
  const wrapped = deg % turn
  return wrapped < 0 ? wrapped + turn : wrapped
}

function sleep(ms) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms)
  })
}

function launchOpts(headed) {
  return {
    channel: "chrome",
    headless: !headed,
    args: [
      "--ignore-gpu-blocklist",
      "--enable-webgl",
      "--use-gl=angle",
      "--use-angle=d3d11",
      "--disable-software-rasterizer",
    ],
  }
}

async function paintReady(page) {
  return page.evaluate(() => {
    const canvas = document.querySelector("#host canvas")
    if (!(canvas instanceof HTMLCanvasElement)) return false
    if (canvas.width < 16 || canvas.height < 16) return false
    const gl = canvas.getContext("webgl2") || canvas.getContext("webgl")
    if (gl === null) return false
    const pix = new Uint8Array(16)
    gl.readPixels(Math.floor(canvas.width / 2), Math.floor(canvas.height / 2), 2, 2, gl.RGBA, gl.UNSIGNED_BYTE, pix)
    let i = 0
    while (i < pix.length) {
      if (pix[i] > 12 || pix[i + 1] > 12 || pix[i + 2] > 12) return true
      i += 4
    }
    return false
  })
}

function selectedShots() {
  const only = new Set(onlyIds)
  if (only.size === 0) return SHOTS
  const picked = SHOTS.filter((shot) => only.has(shot.id))
  if (picked.length === 0) {
    throw new Error("no matching shot ids: " + [...only].join(","))
  }
  return picked
}

async function captureWithPage(page) {
  const shots = selectedShots()
  page.setDefaultTimeout(180000)
  await page.goto(PREVIEW, { waitUntil: "domcontentloaded" })
  await page.waitForFunction((needAa) => {
    const g = globalThis
    const meta = g.__look03
    if (!meta || !meta.ready || meta.gpuCode || !g.__islandCapture) return false
    if (!needAa) return true
    return Boolean(meta.output && meta.output.antialias)
  }, MASTER)
  const loadError = await page.evaluate(() => {
    const meta = globalThis.__look03
    return typeof meta.loadError === "string" ? meta.loadError : ""
  })
  if (loadError.length > 0) {
    throw new Error("preview loadError: " + loadError)
  }
  await sleep(4000)
  let painted = false
  let tries = 0
  while (tries < 20) {
    painted = await paintReady(page)
    if (painted) break
    await sleep(500)
    tries += 1
  }
  if (!painted) {
    throw new Error("canvas stayed empty after load")
  }
  const canvasInfo = await page.evaluate(() => {
    const canvas = document.querySelector("#host canvas")
    const meta = globalThis.__look03
    const width = canvas instanceof HTMLCanvasElement ? canvas.width : 0
    const height = canvas instanceof HTMLCanvasElement ? canvas.height : 0
    const aa = Boolean(meta && meta.output && meta.output.antialias)
    return { width, height, aa }
  })
  console.log("canvas", canvasInfo)
  if (MASTER && (canvasInfo.width < VIEW_W - 8 || canvasInfo.height < VIEW_H - 8 || !canvasInfo.aa)) {
    throw new Error("master canvas is not 4K MSAA: " + JSON.stringify(canvasInfo))
  }
  const hero = await page.evaluate(() => globalThis.__look03.camera)
  const az0 = Number(hero.azimuthDeg)
  const el0 = Number(hero.elevationDeg)
  const d0 = Number(hero.distance)
  if (!Number.isFinite(az0) || !Number.isFinite(el0) || !Number.isFinite(d0) || d0 <= 0) {
    throw new Error("bad hero camera " + JSON.stringify(hero))
  }
  const written = []
  for (const shot of shots) {
    const az = wrapAz(az0 + shot.dAz)
    const el = el0 + shot.dEl
    const dist = d0 * shot.distMul
    await page.evaluate(async ({ az, el, dist }) => {
      globalThis.__islandCapture.apply(az, el, dist, 12)
      await new Promise((resolve) => {
        requestAnimationFrame(() => {
          requestAnimationFrame(resolve)
        })
      })
    }, { az, el, dist })
    await sleep(MASTER ? 1200 : 700)
    const dest = join(outDir, shot.id + ".png")
    const tmp = dest + ".tmp"
    await page.screenshot({ path: tmp, type: "png" })
    try {
      writeFileSync(dest, readFileSync(tmp))
    } catch {
      writeFileSync(join(outDir, shot.id + "_new.png"), readFileSync(tmp))
    }
    try {
      unlinkSync(tmp)
    } catch {
      /* ignore */
    }
    written.push({
      file: shot.id + ".png",
      why: shot.why,
      azimuth: Math.round(az * 10) / 10,
      elevation: Math.round(el * 10) / 10,
      distance: Math.round(dist),
    })
    console.log("wrote", shot.id)
  }
  const metaPath = join(outDir, "shots.json")
  const merged = onlyIds.length > 0 && existsSync(metaPath)
    ? JSON.parse(readFileSync(metaPath, "utf8"))
    : { hero: { az0, el0, d0 }, shots: [] }
  merged.hero = { az0, el0, d0 }
  const byFile = new Map()
  for (const row of merged.shots ?? []) {
    if (row && typeof row.file === "string") byFile.set(row.file, row)
  }
  for (const row of written) byFile.set(row.file, row)
  merged.shots = SHOTS.map((shot) => byFile.get(shot.id + ".png")).filter(Boolean)
  writeFileSync(metaPath, JSON.stringify(merged, null, 2))
  console.log("ok", written.length, "stills ->", outDir)
}

async function main() {
  mkdirSync(outDir, { recursive: true })
  let headed = false
  let lastError = null
  while (headed === false || headed === true) {
    const browser = await chromium.launch(launchOpts(headed))
    const page = await browser.newPage({
      viewport: { width: VIEW_W, height: VIEW_H },
      deviceScaleFactor: 1,
    })
    try {
      await captureWithPage(page)
      await browser.close()
      return
    } catch (err) {
      lastError = err
      await browser.close()
      if (headed) break
      console.warn("headless capture failed, retrying headed:", err instanceof Error ? err.message : err)
      headed = true
    }
  }
  throw lastError instanceof Error ? lastError : new Error(String(lastError))
}

await main()
