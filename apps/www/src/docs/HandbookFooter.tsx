import { useContext, type ReactNode } from "react"
import { contractStatus, footerCopy } from "../data/shell"
import { Destination, Link, SiteContext } from "../site"
import { HandRule } from "./sketch/Sketch"

function ActionInk({ seed, children }: { seed: string; children: ReactNode }) {
  return (
    <>
      <span>{children}</span>
      <HandRule seed={seed} className="hb-footer__action-rule" />
    </>
  )
}

function LinkInk({ seed, children }: { seed: string; children: ReactNode }) {
  return (
    <span className="hb-footer__link-text">
      {children}
      <HandRule seed={seed} className="hb-footer__link-rule" />
    </span>
  )
}
export function HandbookFooter() {
  const { openPlay } = useContext(SiteContext)
  const contract = contractStatus()
  const address = contract.copyValue === null ? "0x000...." : contract.label
  return (
    <footer className="hb-footer">
      <div className="hb-footer__sheet">
        <div className="hb-footer__rule" aria-hidden="true">
          <svg className="hb-footer__stroke" viewBox="0 0 1200 16" preserveAspectRatio="none" focusable="false">
            <path
              d="M1 8.2 C 54 5.4, 96 11.6, 168 7.4 C 232 3.8, 286 12.4, 372 8.6 C 454 5.1, 498 12.8, 590 7.2 C 668 2.8, 724 11.2, 812 8.4 C 892 5.6, 948 12.6, 1046 7.6 C 1118 4.2, 1162 10.4, 1199 8"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.35"
              strokeLinecap="round"
              vectorEffect="non-scaling-stroke"
            />
          </svg>
        </div>
        <div className="hb-footer__inner">
          <div className="hb-footer__copy">
            <h2>{footerCopy.heading}</h2>
            <div className="hb-footer__actions">
              <button type="button" className="hb-footer__action hb-footer__action--go" onClick={openPlay}>
                <ActionInk seed="footer-play">Play now</ActionInk>
              </button>
              <Link to="/docs" className="hb-footer__action">
                <ActionInk seed="footer-docs">Read the docs</ActionInk>
              </Link>
              <Destination kind="x" className="hb-footer__action">
                <ActionInk seed="footer-x">Follow on X</ActionInk>
              </Destination>
            </div>
          </div>
          <div className="hb-footer__bar">
            <nav className="hb-footer__links" aria-label="Footer">
              <Link to="/rating">
                <LinkInk seed="footer-rating">Rating</LinkInk>
              </Link>
              <Link to="/leaderboard">
                <LinkInk seed="footer-leaderboard">Leaderboard</LinkInk>
              </Link>
            </nav>
            <p className="hb-footer__contract">
              <span>$CORP</span>
              <span>{address}</span>
            </p>
          </div>
        </div>
      </div>
    </footer>
  )
}
