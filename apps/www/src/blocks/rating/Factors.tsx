import type { CSSProperties } from "react"
import { ArrowUpRight, CircleSlash, Snowflake, SlidersHorizontal } from "lucide-react"
import { ratingFactors, ratingFactorsCopy, ratingFactorVisuals, type RatingFactorId } from "../../data/rating"
import { FactorMark } from "./FactorMark"
import { fill } from "./fill"
import { SectionHead } from "./SectionHead"

type LineKind = (typeof ratingFactors)[number]["lines"][number]["kind"]

function percent(value: number): CSSProperties {
  return { "--w": `${value}%` } as CSSProperties
}

function GdpVisual() {
  const { pairs, earnedShare, caption } = ratingFactorVisuals.gdp
  return (
    <div className="rvis rvis--gdp">
      <p className="rvis-gdp__eq" aria-hidden="true">
        <span className="rvis-figure__n">{earnedShare}%</span>
        <span className="rvis-gdp__eq-mark">=</span>
        <span className="rvis-figure__n">{earnedShare}%</span>
      </p>
      {pairs.map((pair) => (
        <div key={pair.id} className="rvis-gdp__row">
          <span className="rvis-gdp__track">
            <span className="rvis-gdp__spent" style={percent(pair.width)} />
          </span>
          <span className="rvis-gdp__meta type-caption">
            {pair.spent} · {pair.earned}
          </span>
        </div>
      ))}
      <p className="rvis__caption type-caption">{caption}</p>
    </div>
  )
}

function StabilityVisual() {
  const { ticks, invalid, caption } = ratingFactorVisuals.stability
  const bad = new Set<number>(invalid)
  const valid = ticks - bad.size
  return (
    <div className="rvis rvis--stability">
      <p className="rvis-figure" aria-hidden="true">
        <span className="rvis-figure__n">{valid}</span>
        <span className="rvis-figure__of">/ {ticks}</span>
      </p>
      <span className="rvis-ticks">
        {Array.from({ length: ticks }, (_, index) => (
          <span key={index} className={bad.has(index) ? "rvis-tick is-bad" : "rvis-tick"} />
        ))}
      </span>
      <p className="rvis__caption type-caption">{fill(caption, { valid: ticks - bad.size, ticks })}</p>
    </div>
  )
}

function EfficiencyVisual() {
  const { low, mid, high, midLabel, caption } = ratingFactorVisuals.efficiency
  return (
    <div className="rvis rvis--efficiency">
      <p className="rvis-figure" aria-hidden="true">
        <span className="rvis-figure__n">{mid}</span>
        <span className="rvis-figure__of">{midLabel}</span>
      </p>
      <span className="rvis-range">
        <span className="rvis-range__track" />
        <span className="rvis-range__mid" />
      </span>
      <span className="rvis-range__labels type-caption">
        <span>{low}</span>
        <span className="rvis-range__neutral">{mid}</span>
        <span>{high}</span>
      </span>
      <p className="rvis__caption type-caption">{caption}</p>
    </div>
  )
}

function CoverageVisual() {
  const { industries, legend, caption } = ratingFactorVisuals.coverage
  const produced = industries.filter((item) => item.state === "produced").length
  const open = industries.filter((item) => item.state !== "closed").length
  return (
    <div className="rvis rvis--coverage">
      <p className="rvis-figure" aria-hidden="true">
        <span className="rvis-figure__n">{produced}</span>
        <span className="rvis-figure__of">/ {open}</span>
      </p>
      <span className="rvis-inds">
        {industries.map((item) => (
          <span key={item.id} className={`rvis-ind is-${item.state}`} style={{ "--ind": `var(--site-ind-${item.id})` } as CSSProperties}>
            <span className="rvis-ind__dot">{item.state === "frozen" ? <Snowflake size={10} /> : null}</span>
            <span className="rvis-ind__ticker">{item.ticker}</span>
          </span>
        ))}
      </span>
      <span className="rvis-inds__legend type-caption">
        <span className="is-produced">{legend.produced}</span>
        <span className="is-frozen">{legend.frozen}</span>
        <span className="is-closed">{legend.closed}</span>
      </span>
      <p className="rvis__caption type-caption">{fill(caption, { produced, open })}</p>
    </div>
  )
}

function Visual({ id }: { id: RatingFactorId }) {
  switch (id) {
    case "gdp":
      return <GdpVisual />
    case "stability":
      return <StabilityVisual />
    case "efficiency":
      return <EfficiencyVisual />
    case "coverage":
      return <CoverageVisual />
    default: {
      const unexpected: never = id
      return unexpected
    }
  }
}

function LineIcon({ kind }: { kind: LineKind }) {
  switch (kind) {
    case "raises":
      return <ArrowUpRight size={14} />
    case "zeroes":
      return <CircleSlash size={14} />
    case "lever":
      return <SlidersHorizontal size={14} />
    default: {
      const unexpected: never = kind
      return unexpected
    }
  }
}

export function Factors() {
  return (
    <section id="rating-factors" className="rsec" aria-labelledby="rating-factors-title">
      <SectionHead id="rating-factors-title" eyebrow={ratingFactorsCopy.eyebrow} title={ratingFactorsCopy.title} />
      <div className="rfactors">
        {ratingFactors.map((factor) => (
          <article key={factor.id} className="rfactor">
            <div className="rfactor__vis" aria-hidden="true">
              <Visual id={factor.id} />
            </div>
            <div className="rfactor__head">
              <FactorMark id={factor.id} size={16} />
              <h3 className="type-heading-4">{factor.title}</h3>
            </div>
            <p className="rfactor__body type-body-sm">{factor.body}</p>
            <dl className="rfactor__lines">
              {factor.lines.map((line) => (
                <div key={line.kind} className={`rfactor__line is-${line.kind}`}>
                  <dt className="type-label">
                    <LineIcon kind={line.kind} />
                    {ratingFactorsCopy[line.kind]}
                  </dt>
                  <dd className="type-body-sm">{line.text}</dd>
                </div>
              ))}
            </dl>
          </article>
        ))}
      </div>
    </section>
  )
}
