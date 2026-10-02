import { useContext, type CSSProperties } from "react"
import heroUrl from "../assets/opt/hero.webp"
import heroMobileBgUrl from "../assets/opt/hero-mobile-bg.webp"
import robinhoodUrl from "../../../../website/brand/robinhood-chain/robinhood-chain-brand-assets-v1/Robinhood Chain Brand Assets - V1/Robinhood Chain Logo/Robinhood_Chain_Logo_Black.svg"
import { Button } from "../components/Button"
import { heroCopy } from "../data/hero"
import { Link, SiteContext } from "../site"
import "../styles/hero.css"

export function Hero() {
  const { openPlay } = useContext(SiteContext)
  return (
    <section
      id="hero"
      className="hero"
      data-theme="sky"
      style={{ "--hero-art": `url(${JSON.stringify(heroUrl)})` } as CSSProperties}
    >
      <div className="hero__stage">
        <picture className="hero__frame">
          <source media="(min-width: 701px)" srcSet={heroUrl} width={1671} height={941} />
          <img
            className="hero__art"
            src={heroUrl}
            alt=""
            width={1671}
            height={941}
            fetchPriority="high"
            decoding="async"
          />
        </picture>
      </div>
      <div className="site-container">
        <div className="hero__copy">
          <h1 className="type-display-hero">{heroCopy.headline}</h1>
          <p className="hero__subtitle type-body-lg">{heroCopy.subtitle}</p>
          <div className="hero__mark">
            <span className="hero__wordmark">
              <img
                className="hero__logo"
                src={robinhoodUrl}
                alt="Robinhood Chain"
                width={1576}
                height={207}
                decoding="async"
              />
            </span>
            <span className="hero__chain" aria-hidden="true">
              <img src={robinhoodUrl} alt="" decoding="async" />
              <img src={robinhoodUrl} alt="" decoding="async" />
              <img src={robinhoodUrl} alt="" decoding="async" />
              <img src={robinhoodUrl} alt="" decoding="async" />
              <img src={robinhoodUrl} alt="" decoding="async" />
            </span>
          </div>
          <div className="site-button-row hero__actions">
            <Button size="sm" trailingIcon onClick={openPlay}>
              {heroCopy.play}
            </Button>
            <Link to="/docs" className="site-button type-button site-button--sm site-button--secondary">
              {heroCopy.how}
            </Link>
          </div>
        </div>
      </div>
      <picture className="hero__plate">
        <source media="(max-width: 700px)" srcSet={heroMobileBgUrl} width={887} height={1774} />
        <img
          alt=""
          src="data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7"
          width={887}
          height={1774}
          decoding="async"
          fetchPriority="high"
        />
      </picture>
    </section>
  )
}
