import welcomeArtUrl from "../../../../hud/quick-guide-reference/welcome-ready/welcome-art.png?url"
import bankArtUrl from "../../../../hud/quick-guide-reference/bank-ready/bank-art.png?url"
import workshopArtUrl from "../../../../hud/quick-guide-reference/workshop-ready/workshop-art.png?url"
import peopleArtUrl from "../../../../hud/quick-guide-reference/people-ready/people-art.png?url"
import workArtUrl from "../../../../hud/quick-guide-reference/to-work-ready/to-work-art.png?url"
import shiftArtUrl from "../../../../hud/quick-guide-reference/first-shift-ready/first-shift-art.png?url"
import screenArtUrl from "../../../../hud/quick-guide-reference/screen-ready/screen-art.png?url"
import nextArtUrl from "../../../../hud/quick-guide-reference/whats-next-ready/whats-next-art.png?url"
import brandUrl from "../../../../hud/quick-guide-reference/bank-ready/brand-mark.png?url"
import packUrl from "../../../../content/out/pack.json?url"
import { parseJson } from "@corporator/contentpack"
import { offlineWindowOf } from "../hud/flows.js"
import { loadClientPack } from "../packview.js"
import { CANVAS, STEPS } from "./guideLayout.js"
import { buildMarks } from "./marks.js"
import "./quick-guide.css"

const WELCOME_ALT = "The detailed Corporator island with four blue handwritten route stops: start here at the Bank, switch on the Workshop and Power Node, hire people beside the Engineer, and wait for the hour at the clock. All tutorial annotations are already part of this illustration."

function must<T extends Element>(root: ParentNode, selector: string): T {
  const node = root.querySelector<T>(selector)
  if (node === null) throw new Error(`quick guide: missing ${selector}`)
  return node
}

const doc = document.documentElement
const panel = must<HTMLElement>(document, ".qg-panel")
const welcomeArt = must<HTMLImageElement>(panel, ".qg-welcome-art")
const bankArt = must<HTMLImageElement>(panel, ".qg-bank-art")
const workshopArt = must<HTMLImageElement>(panel, ".qg-workshop-art")
const peopleArt = must<HTMLImageElement>(panel, ".qg-people-art")
const workArt = must<HTMLImageElement>(panel, ".qg-work-art")
const shiftArt = must<HTMLImageElement>(panel, ".qg-shift-art")
const screenArt = must<HTMLImageElement>(panel, ".qg-screen-art")
const nextArt = must<HTMLImageElement>(panel, ".qg-next-art")
const brand = must<HTMLImageElement>(panel, ".qg-brand__img")
const footnote = must<HTMLElement>(panel, ".qg-footnote")
const marks = must<SVGSVGElement>(panel, ".qg-marks")
const eyebrow = must<HTMLElement>(panel, ".qg-eyebrow")
const title = must<HTMLElement>(panel, ".qg-title")
const lede = must<HTMLElement>(panel, ".qg-lede")
const back = must<HTMLButtonElement>(panel, ".qg-back")
const next = must<HTMLButtonElement>(panel, ".qg-next")
const nextLabel = must<HTMLElement>(panel, ".qg-next__label")
const dotsBox = must<HTMLElement>(panel, ".qg-dots")
const count = must<HTMLElement>(panel, ".qg-count")
const reopen = must<HTMLButtonElement>(document, ".qg-reopen")

welcomeArt.src = welcomeArtUrl
welcomeArt.alt = WELCOME_ALT
bankArt.src = bankArtUrl
workshopArt.src = workshopArtUrl
peopleArt.src = peopleArtUrl
workArt.src = workArtUrl
shiftArt.src = shiftArtUrl
screenArt.src = screenArtUrl
nextArt.src = nextArtUrl
brand.src = brandUrl

const OFFLINE_TOKEN = "{offline_hours}"
let offlineHours = ""

function fit(): void {
  const k = Math.min(window.innerWidth / CANVAS.w, window.innerHeight / CANVAS.h)
  doc.style.setProperty("--qg-k", String(k))
}
fit()
window.addEventListener("resize", fit)

const dots: HTMLButtonElement[] = STEPS.map((_, i) => {
  const b = document.createElement("button")
  b.type = "button"
  b.className = "qg-dot"
  b.setAttribute("aria-label", `Step ${i + 1} of ${STEPS.length}`)
  b.addEventListener("click", () => show(i))
  dotsBox.append(b)
  return b
})

let current = 0
let painted = -1
let leaving = false
let motionToken = 0

// Same page change as apps/www/src/pageTransition.tsx.
const STEP_ENTER_MS = 320
const STEP_EXIT_MS = 160
const STEP_ENTER_EASE = "cubic-bezier(0.22, 1, 0.36, 1)"
const STEP_EXIT_EASE = "cubic-bezier(0.4, 0, 0.6, 1)"
const STEP_RISE_PX = 10

const spread = must<HTMLElement>(panel, ".qg-spread")
const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)")

function setFootnote(text: string): void {
  const at = text.indexOf(OFFLINE_TOKEN)
  if (at < 0) {
    footnote.textContent = text
    return
  }
  const hours = document.createElement("span")
  hours.dataset["token"] = "offline_hours"
  hours.textContent = offlineHours
  footnote.replaceChildren(
    document.createTextNode(text.slice(0, at)),
    hours,
    document.createTextNode(text.slice(at + OFFLINE_TOKEN.length)),
  )
}

function paint(index: number): void {
  const step = STEPS[index]
  if (step === undefined) return
  const stepNo = index + 1
  panel.dataset["step"] = String(stepNo)
  doc.dataset["guideStep"] = String(stepNo)
  panel.dataset["plate"] = step.scene
  eyebrow.textContent = step.eyebrow
  title.textContent = step.title
  lede.textContent = step.lede
  lede.hidden = step.lede === ""
  setFootnote(step.footnote)
  buildMarks(marks, step.marks)
  painted = index
}

function chrome(index: number): void {
  count.textContent = `${index + 1} / ${STEPS.length}`
  dots.forEach((d, i) => {
    d.classList.toggle("is-active", i === index)
    if (i === index) d.setAttribute("aria-current", "page")
    else d.removeAttribute("aria-current")
  })
  back.disabled = index === 0
  const last = index === STEPS.length - 1
  nextLabel.textContent = last ? "Start playing" : "Next"
  next.setAttribute("aria-label", last ? "Start playing" : "Next step")
}

function dropMotion(): void {
  for (const anim of spread.getAnimations()) {
    anim.onfinish = null
    anim.cancel()
  }
  spread.style.opacity = ""
  spread.style.transform = ""
}

function show(index: number): void {
  if (STEPS[index] === undefined) return
  const refresh = index === current && painted === index && !leaving
  current = index
  chrome(index)
  if (refresh) {
    paint(index)
    return
  }
  if (painted < 0 || reduceMotion.matches) {
    dropMotion()
    leaving = false
    paint(index)
    return
  }
  if (leaving) return
  leaving = true
  const token = ++motionToken
  const from = Number(getComputedStyle(spread).opacity)
  dropMotion()
  const exit = spread.animate([{ opacity: Number.isFinite(from) ? from : 1 }, { opacity: 0 }], {
    duration: STEP_EXIT_MS,
    easing: STEP_EXIT_EASE,
    fill: "forwards",
  })
  exit.onfinish = () => {
    if (token !== motionToken) return
    exit.onfinish = null
    exit.cancel()
    paint(current)
    leaving = false
    spread.style.opacity = "0"
    spread.style.transform = `translateY(${STEP_RISE_PX}px)`
    const enter = spread.animate(
      [
        { opacity: 0, transform: `translateY(${STEP_RISE_PX}px)` },
        { opacity: 1, transform: "translateY(0px)" },
      ],
      { duration: STEP_ENTER_MS, easing: STEP_ENTER_EASE, fill: "forwards" },
    )
    enter.onfinish = () => {
      if (token !== motionToken) return
      enter.onfinish = null
      spread.style.opacity = ""
      spread.style.transform = ""
      enter.cancel()
    }
  }
}

function open(): void {
  doc.dataset["guide"] = "open"
  panel.hidden = false
  reopen.hidden = true
  motionToken += 1
  dropMotion()
  leaving = false
  painted = -1
  show(0)
  next.focus()
}

function close(): void {
  motionToken += 1
  dropMotion()
  leaving = false
  doc.dataset["guide"] = "closed"
  panel.hidden = true
  reopen.hidden = false
  reopen.focus()
}

back.addEventListener("click", () => show(current - 1))
next.addEventListener("click", () => {
  if (current === STEPS.length - 1) close()
  else show(current + 1)
})
document.querySelectorAll<HTMLButtonElement>("[data-guide-close]").forEach((b) => {
  b.addEventListener("click", close)
})
reopen.addEventListener("click", open)

document.addEventListener("keydown", (e) => {
  if (panel.hidden) return
  if (e.key === "Escape") {
    e.preventDefault()
    close()
  } else if (e.key === "ArrowRight" && current < STEPS.length - 1) {
    show(current + 1)
  } else if (e.key === "ArrowLeft" && current > 0) {
    show(current - 1)
  }
})

show(0)

void (async () => {
  const res = await fetch(packUrl)
  if (!res.ok) throw new Error("quick guide: pack")
  offlineHours = offlineWindowOf(loadClientPack(parseJson(await res.text()))).clippedHours.toString()
  const step = STEPS[current]
  if (step !== undefined && step.footnote.includes(OFFLINE_TOKEN)) show(current)
})()
