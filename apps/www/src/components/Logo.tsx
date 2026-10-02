import markUrl from "../assets/mark.png"
import { Link } from "../site"

export function Logo() {
  return (
    <Link to="/" className="site-logo" aria-label="Corporator">
      <img src={markUrl} alt="" width={96} height={110} />
      <span className="site-wordmark">Corporator</span>
    </Link>
  )
}
