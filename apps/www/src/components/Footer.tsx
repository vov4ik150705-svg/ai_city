import { useContext, useEffect, useState } from "react"
import futerUrl from "../assets/opt/footer.webp"
import { docsLinks } from "../data/docsLinks"
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

const tokenAddressPlaceholder = `0x${"0".repeat(40)}`

export function Footer() {
  const { openPlay } = useContext(SiteContext)
  const contract = contractStatus()
  const address = contract.copyValue ?? tokenAddressPlaceholder
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    if (!copied) return
    const timer = window.setTimeout(() => setCopied(false), 1600)
    return () => window.clearTimeout(timer)
  }, [copied])

  async function copyAddress() {
    try {
      await navigator.clipboard.writeText(address)
      setCopied(true)
    } catch {
      setCopied(false)
    }
  }

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
            <Link to={docsLinks.gettingStarted} className="site-button type-button site-button--md site-button--secondary">
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
          <nav className="site-button-row" aria-label="Footer">
            <Link to="/rating" className="site-button type-button site-button--md site-button--secondary">
              Rating
            </Link>
            <Link to="/leaderboard" className="site-button type-button site-button--md site-button--secondary">
              Leaderboard
            </Link>
          </nav>
          <button
            type="button"
            className="site-button type-button site-button--md site-button--primary site-footer__contract"
            onClick={() => void copyAddress()}
          >
            <span>{copied ? "Copied" : "$CORP"}</span>
            <span>{address}</span>
            <span className="site-footer__sr" aria-live="polite">
              {copied ? "Copied" : ""}
            </span>
          </button>
        </div>
      </div>
    </footer>
  )
}
