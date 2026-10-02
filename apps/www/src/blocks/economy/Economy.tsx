import { ArrowLink, Heading } from "../../components/text"
import { docsLinks } from "../../data/docsLinks"
import { economyArt, economyGuideLabel, economyHeading, economyLead } from "../../data/economy"
import "./economy.css"
import { EconomyPanel } from "./Panel"

const skyStrips = Array.from({ length: 12 }, (_, index) => index)

export function Economy() {
  return (
    <section id="economy" className="economy site-section" data-theme="sky">
      <div className="economy__scene">
        <img
          className="economy__art"
          src={economyArt.src}
          alt=""
          width={economyArt.width}
          height={economyArt.height}
          loading="lazy"
          decoding="async"
        />
        <div className="economy__sky" aria-hidden="true">
          {skyStrips.map((strip) => (
            <span key={strip} />
          ))}
        </div>
        <div className="site-container economy__copy">
          <div className="economy__title">
            <Heading level={2} role="display-1">
              {economyHeading}
            </Heading>
          </div>
          <p className="economy__lead type-body">
            {economyLead.map((line) => (
              <span key={line}>{line} </span>
            ))}
          </p>
          <ArrowLink to={docsLinks.economy} className="economy__guide">
            {economyGuideLabel}
          </ArrowLink>
        </div>
      </div>
      <div className="site-container economy__sheet">
        <EconomyPanel />
      </div>
    </section>
  )
}
