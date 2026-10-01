import type { CSSProperties } from "react"
import { ArrowDown, Check, Wallet, X } from "lucide-react"
import { ratingOrder } from "../../data/rating"
import { SectionHead } from "./SectionHead"

function share(value: number): CSSProperties {
  return { "--share": `${value}%` } as CSSProperties
}

function Ladder() {
  return (
    <ol className="rorder__ladder">
      {ratingOrder.steps.map((step, index) => (
        <li key={step.id} className="rorder__rung">
          {index > 0 ? (
            <span className="rorder__tie type-label">
              <ArrowDown size={14} aria-hidden="true" />
              {ratingOrder.tie}
            </span>
          ) : null}
          <div className="rorder__step">
            <span className="rorder__n type-numeric">{index + 1}</span>
            <span className="rorder__step-copy">
              <span className="type-heading-4">{step.label}</span>
              <span className="type-body-sm">{step.text}</span>
            </span>
          </div>
        </li>
      ))}
    </ol>
  )
}

function WalletMerge() {
  const { wallet } = ratingOrder
  const [first, second] = wallet.cities
  const best = Math.max(first.share, second.share)
  return (
    <figure className="rwallet">
      <figcaption className="rwallet__copy">
        <span className="type-heading-4">{wallet.title}</span>
        <span className="type-body-sm">{wallet.text}</span>
      </figcaption>
      <div className="rwallet__chart" aria-hidden="true">
        <p className="rwallet__owner type-label">
          <Wallet size={14} />
          {wallet.wallet}
        </p>
        <div className="rwallet__row rwallet__row--axis">
          <span />
          <span className="type-caption">{wallet.axis}</span>
        </div>
        {wallet.cities.map((city) => (
          <div key={city.id} className={`rwallet__row rwallet__row--${city.id}`}>
            <span className="type-caption">{city.label}</span>
            <span className="rwallet__track">
              <span className="rwallet__bar" style={share(city.share)} />
            </span>
          </div>
        ))}
        <div className="rwallet__row rwallet__row--result">
          <span className="rwallet__verdict rwallet__verdict--yes">
            <Check size={12} />
          </span>
          <span className="rwallet__track">
            <span className="rwallet__bar" style={share(best)} />
          </span>
          <span className="type-caption">{wallet.row}</span>
        </div>
        <div className="rwallet__row rwallet__row--sum">
          <span className="rwallet__verdict rwallet__verdict--no">
            <X size={12} />
          </span>
          <span className="rwallet__track">
            <span className="rwallet__bar rwallet__bar--a" style={share(first.share)} />
            <span className="rwallet__bar rwallet__bar--b" style={share(second.share)} />
          </span>
          <span className="type-caption">
            {wallet.sum}: {wallet.sumNote}
          </span>
        </div>
      </div>
    </figure>
  )
}

export function Order() {
  return (
    <section id="rating-order" className="rsec" aria-labelledby="rating-order-title">
      <SectionHead id="rating-order-title" eyebrow={ratingOrder.eyebrow} title={ratingOrder.title} lead={ratingOrder.lead} />
      <div className="rorder">
        <Ladder />
        <WalletMerge />
      </div>
    </section>
  )
}
