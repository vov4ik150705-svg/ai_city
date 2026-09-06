import type { ReactElement } from "react"
import { screens } from "@corporator/protocol"
import type { HudView } from "../model.js"

export function StockBar(props: { readonly stocks: HudView["stocks"] }): ReactElement {
  return (
    <div data-surface={screens.stock_bar} className="hud-panel hud-stocks">
      {props.stocks.map((s) => (
        <div key={s.ticker} className="hud-stock" data-ticker={s.ticker}>
          <div className="hud-stock__t">{s.ticker}</div>
          <div className="hud-stock__n" data-stock-market>
            {s.price}
          </div>
          <div className={s.tone === "ok" ? "hud-stock__n hud-muted" : `hud-stock__n hud-row--${s.tone}`}>
            {s.dayPct}
          </div>
          <div className="hud-stock__n hud-muted" data-stock-effect>
            {s.effect}
          </div>
        </div>
      ))}
    </div>
  )
}

export function BottomMenu(props: {
  readonly items: HudView["menu"]
  readonly onNavigate: (id: string) => void
}): ReactElement {
  return (
    <nav data-surface={screens.bottom_menu} className="hud-panel hud-menu">
      {props.items.map((item) => (
        <button
          key={item.id}
          type="button"
          data-key={item.key}
          data-blocked={item.blocked ? "1" : "0"}
          disabled={item.blocked}
          onClick={() => {
            if (item.target.length > 0) props.onNavigate(item.target)
          }}
        >
          {item.text}
        </button>
      ))}
    </nav>
  )
}
