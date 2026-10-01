import { ArrowRight, Info } from "lucide-react"
import type { EconomyPicture, EconomyRules } from "../../data/economy"
import { economyVoucherTip } from "../../data/economy"
import { Term } from "./Term"

export function Flow({ steps }: { steps: readonly EconomyPicture[] }) {
  return (
    <ol className="economy-flow">
      {steps.map((step, index) => (
        <li key={step.name} className="economy-flow__step">
          <span className="economy-flow__pic">
            {index > 0 ? <ArrowRight className="economy-flow__arrow" size={16} aria-hidden="true" /> : null}
            <img src={step.src} alt="" width={step.width} height={step.height} decoding="async" />
          </span>
          <span className="economy-flow__name type-label">{step.name}</span>
          {step.caption !== undefined ? (
            <span className="economy-flow__caption type-caption">{step.caption}</span>
          ) : null}
        </li>
      ))}
    </ol>
  )
}

export function Rules({ rules }: { rules: EconomyRules }) {
  return (
    <div className="economy-col">
      <h3 className="economy-col__title type-label">{rules.title}</h3>
      <ul className="economy-rules">
        {rules.rules.map((rule) => (
          <li key={rule.label} className="economy-rules__item">
            <span className="economy-rules__icon">
              {rule.src !== undefined ? (
                <img
                  src={rule.src}
                  alt=""
                  width={rule.width}
                  height={rule.height}
                  decoding="async"
                  data-bg={rule.darkBg === true ? "dark" : undefined}
                />
              ) : null}
            </span>
            <span className="economy-rules__text">
              <span className="economy-rules__label type-label">
                {rule.term === "voucher" ? <Term tip={economyVoucherTip}>{rule.label}</Term> : rule.label}
              </span>
              <span className="economy-rules__line type-caption">{rule.line}</span>
            </span>
          </li>
        ))}
      </ul>
      <p className="economy-note type-caption">
        <Info size={16} aria-hidden="true" />
        {rules.note}
      </p>
    </div>
  )
}
