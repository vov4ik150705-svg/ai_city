import { Fragment, useState, type CSSProperties } from "react"
import { Ban, CircleCheck, CircleSlash, RotateCcw } from "lucide-react"
import { clockCells } from "../../data/clocks"
import { ratingFactors, ratingInfluence, type RatingFactorId } from "../../data/rating"
import { FactorMark } from "./FactorMark"
import { fill, formatNumber } from "./fill"
import { SectionHead } from "./SectionHead"

type Switchable = Exclude<RatingFactorId, "efficiency">
type EfficiencyId = (typeof ratingInfluence.efficiencyOptions)[number]["id"]

const periodCell = clockCells.find((cell) => cell.id === "prize")
const periodDays = periodCell === undefined ? 0 : periodCell.days
const efficiencyTop = Math.max(...ratingInfluence.efficiencyOptions.map((option) => option.bps))
const zeroDay = Math.min(Math.max(ratingInfluence.zeroDay, 1), periodDays)

function efficiencyBps(id: EfficiencyId): number {
  const option = ratingInfluence.efficiencyOptions.find((item) => item.id === id)
  return option === undefined ? ratingInfluence.neutralBps : option.bps
}

function scoreAt(bps: number): number {
  return Math.floor((ratingInfluence.dayScore * bps) / ratingInfluence.neutralBps)
}

function FactorChip({
  id,
  label,
  on,
  toggle,
}: {
  id: Switchable
  label: string
  on: boolean
  toggle: () => void
}) {
  return (
    <button type="button" role="switch" aria-checked={on} aria-label={label} className="rchip" onClick={toggle}>
      <span className="rchip__top">
        <FactorMark id={id} />
        <span className="rchip__value type-label">{on ? ratingInfluence.onLabel : ratingInfluence.zero}</span>
      </span>
      <span className="rchip__label type-label">{label}</span>
      <span className="rating-switch__track" aria-hidden="true">
        <span className="rating-switch__knob" />
      </span>
    </button>
  )
}

function EfficiencyChip({ value, pick }: { value: EfficiencyId; pick: (id: EfficiencyId) => void }) {
  const factor = ratingFactors.find((item) => item.id === "efficiency")
  const label = factor === undefined ? "" : factor.short
  return (
    <div className="rchip rchip--range" role="group" aria-label={label}>
      <span className="rchip__top">
        <FactorMark id="efficiency" />
      </span>
      <span className="rchip__label type-label">{label}</span>
      <span className="rchip__seg">
        {ratingInfluence.efficiencyOptions.map((option) => (
          <button
            key={option.id}
            type="button"
            aria-pressed={option.id === value}
            className="rchip__seg-item type-metadata"
            onClick={() => pick(option.id)}
          >
            {option.label}
          </button>
        ))}
      </span>
    </div>
  )
}

function SumChart({ score, live }: { score: number; live: boolean }) {
  const top = scoreAt(efficiencyTop) * periodDays
  const days = Array.from({ length: periodDays }, (_, index) => index + 1)
  let running = 0
  const columns = days.map((day) => {
    const add = live || day !== zeroDay ? score : 0
    running += add
    return { day, add, cum: running }
  })
  const total = running
  return (
    <figure className="rsum">
      <figcaption className="rsum__head">
        <span className="type-heading-4">{ratingInfluence.sumTitle}</span>
        <span className="rsum__total type-numeric-lg">{formatNumber(total)}</span>
      </figcaption>
      <p className="rsum__caption type-body-sm" aria-live="polite">
        {live
          ? fill(ratingInfluence.sumLive, { day: score, days: periodDays, total })
          : fill(ratingInfluence.sumZero, { zeroDay, total })}
      </p>
      <div className="rsum__plot" aria-hidden="true">
        {columns.map((column) => (
          <span
            key={column.day}
            className={column.add === 0 ? "rsum__col is-zero" : "rsum__col"}
            style={
              {
                "--cum": top === 0 ? 0 : column.cum / top,
                "--add": column.cum === 0 ? 0 : column.add / column.cum,
              } as CSSProperties
            }
          >
            <span className="rsum__bar">
              <span className="rsum__add" />
            </span>
          </span>
        ))}
        <span className="rsum__reset">
          <RotateCcw size={12} />
        </span>
      </div>
      <div className="rsum__axis type-caption" aria-hidden="true">
        <span>
          {ratingInfluence.dayLabel} 1
        </span>
        <span>
          {ratingInfluence.dayLabel} {periodDays}
        </span>
      </div>
      <ul className="rsum__legend">
        <li className="type-caption">
          <span className="rsum__key rsum__key--add" aria-hidden="true" />
          {ratingInfluence.scoredAt}
        </li>
        <li className="type-caption">
          <span className="rsum__key rsum__key--reset" aria-hidden="true">
            <RotateCcw size={10} />
          </span>
          {fill(ratingInfluence.resetAt, { days: periodDays })}
        </li>
      </ul>
    </figure>
  )
}

export function Influence() {
  const [on, setOn] = useState<Record<Switchable, boolean>>({ gdp: true, stability: true, coverage: true })
  const [efficiency, setEfficiency] = useState<EfficiencyId>("mid")
  const live = on.gdp && on.stability && on.coverage
  const score = scoreAt(efficiencyBps(efficiency))
  const shown = live ? score : 0

  function chip(factor: (typeof ratingFactors)[number]) {
    if (factor.id === "efficiency") return <EfficiencyChip value={efficiency} pick={setEfficiency} />
    const id: Switchable = factor.id
    return (
      <FactorChip
        id={id}
        label={factor.short}
        on={on[id]}
        toggle={() => setOn((current) => ({ ...current, [id]: !current[id] }))}
      />
    )
  }

  return (
    <section id="rating-influence" className="rsec" aria-labelledby="rating-influence-title">
      <SectionHead
        id="rating-influence-title"
        eyebrow={ratingInfluence.eyebrow}
        title={ratingInfluence.title}
        lead={ratingInfluence.lead}
      />
      <div className={live ? "rform" : "rform is-zero"}>
        <div className="rform__eq">
          {ratingFactors.map((factor, index) => (
            <Fragment key={factor.id}>
              {index > 0 ? (
                <span className="rform__op" aria-hidden="true">
                  ×
                </span>
              ) : null}
              {chip(factor)}
            </Fragment>
          ))}
          <span className="rform__op" aria-hidden="true">
            =
          </span>
          <div className="rform__result" aria-live="polite">
            <span className="type-label">{ratingInfluence.result}</span>
            <span className="rform__score type-numeric-lg">{formatNumber(shown)}</span>
          </div>
        </div>
        <div className="rform__verdict">
          {live ? <CircleCheck size={18} aria-hidden="true" /> : <CircleSlash size={18} aria-hidden="true" />}
          <p className="type-body-sm">
            <span className="rform__verdict-title">{live ? ratingInfluence.liveTitle : ratingInfluence.zeroTitle}.</span>{" "}
            {live ? ratingInfluence.liveText : ratingInfluence.zeroText}
          </p>
        </div>
        <p className="rform__hint type-caption">{ratingInfluence.hint}</p>
      </div>
      <SumChart score={score} live={live} />
      <div className="rignored">
        <p className="rignored__title type-label">{ratingInfluence.ignoredTitle}</p>
        <ul className="rignored__list">
          {ratingInfluence.ignored.map((item) => (
            <li key={item.id} className="rignored__item type-body-sm">
              <Ban size={14} aria-hidden="true" />
              {item.text}
            </li>
          ))}
        </ul>
        <p className="rignored__note type-body-sm">{ratingInfluence.spendNote}</p>
      </div>
    </section>
  )
}
