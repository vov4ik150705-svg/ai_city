import { useContext } from "react"
import futerUrl from "../assets/opt/footer.webp"
import { contractStatus, footerCopy } from "../data/shell"
import { Destination, Link, SiteContext } from "../site"
import { Button } from "./Button"

function XMark() {
  return (
    <svg className="site-footer__x" viewBox="0 0 24 24" aria-hidden="true">
      <path
        fill="currentColor"
        d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-4.714-6.231-5.401 6.231H2.744l7.727-8.835L1.254 2.25H8.08l4.253 5.622L18.244 2.25zm-1.161 17.52h1.833L7.084 4.126H5.117z"
      />
    </svg>
  )
}

function CorpMark() {
  return (
    <svg className="site-footer__mark" viewBox="0 0 24 24" aria-hidden="true">
      <circle cx="12" cy="12" r="9.25" fill="none" stroke="currentColor" strokeWidth="1.4" />
      <path
        fill="currentColor"
        d="M15.6 8.15a4.35 4.35 0 1 0 .05 7.75l-1.15-1.2a2.85 2.85 0 1 1-.02-5.35l1.12-1.2z"
      />
    </svg>
  )
}

export function Footer() {
  const { openPlay } = useContext(SiteContext)
  const contract = contractStatus()
  const address = contract.copyValue === null ? "Contract TBA" : contract.label
  return (
    <footer className="site-footer">
      <img className="site-footer__art" src={futerUrl} alt="" width={2170} height={342} loading="lazy" decoding="async" />
      <div className="site-container site-footer__stage">
        <div className="site-footer__copy">
          <h2 className="type-display-2">{footerCopy.heading}</h2>
          <div className="site-button-row">
            <Button size="md" trailingIcon onClick={openPlay}>
              Play now
            </Button>
            <Link to="/docs" className="site-button type-button site-button--md site-button--secondary">
              Read the docs
            </Link>
            <Destination
              kind="x"
              className="site-button type-button site-button--md site-button--secondary site-footer__social"
            >
              <XMark />
              <span className="site-footer__sr">Corporator on X</span>
            </Destination>
          </div>
        </div>
        <div className="site-footer__bar">
          <p className="site-footer__contract">
            <CorpMark />
            <span>$CORP</span>
            <span className="site-footer__dot" aria-hidden="true">
              ·
            </span>
            <span>{address}</span>
          </p>
          <span className="site-footer__rule" aria-hidden="true" />
          <nav className="site-footer__links" aria-label="Footer">
            <Link to="/rating">Rating</Link>
            <span className="site-footer__dot" aria-hidden="true">
              ·
            </span>
            <Link to="/leaderboard">Leaderboard</Link>
            <span className="site-footer__dot" aria-hidden="true">
              ·
            </span>
            <Link to="/docs">Docs</Link>
            <span className="site-footer__dot" aria-hidden="true">
              ·
            </span>
            <Destination kind="x" className="site-footer__xlink">
              <XMark />
              <span className="site-footer__sr">X</span>
            </Destination>
          </nav>
        </div>
      </div>
    </footer>
  )
}
