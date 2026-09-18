import type { ReactElement } from "react"
import type { HudView } from "../model.js"
import { Empty, UnavailableState } from "../parts/Empty.js"
import { Panel } from "../parts/Panel.js"
import { Value } from "../parts/Value.js"

export function ProtocolPlaque(props: { readonly view: HudView }): ReactElement {
  return (
    <div data-key="UI_PROTOCOL">
      {props.view.protocol.map((p) => (
        <div key={p.id} data-key={p.key} className="hud-row">
          <span className="hud-muted">{p.caption}</span>
          {p.kind === "unavailable" ? (
            <span data-key="UI_UNAVAILABLE" className="hud-unavailable">
              {p.value}
            </span>
          ) : (
            <span>{p.value}</span>
          )}
        </div>
      ))}
      {props.view.basket.map((b) => (
        <p key={b.ticker} data-ticker={b.ticker} className="hud-row">
          {b.ticker} {b.farm}
        </p>
      ))}
    </div>
  )
}

export function CityCard(props: { readonly title: string; readonly titleKey: string; readonly view: HudView }): ReactElement {
  return (
    <Panel id="city" title={props.title} titleKey={props.titleKey}>
      <div data-key={props.view.treasury.key} className="hud-row">
        <span className="hud-muted">{props.view.treasury.caption}</span>
        {props.view.treasury.kind === "unavailable" ? (
          <span data-key="UI_UNAVAILABLE" className="hud-unavailable">
            {props.view.treasury.value}
          </span>
        ) : (
          <Value display={props.view.treasury.value} exact={props.view.treasury.exact} />
        )}
      </div>
      <ProtocolPlaque view={props.view} />
      {props.view.prizeNotice ? (
        <p data-key={props.view.prizeNotice.key} className="hud-row hud-row--trim">
          {props.view.prizeNotice.text}
        </p>
      ) : null}
      <p data-key="UI_PRIZE_PERIOD" className="hud-row hud-muted">
        {props.view.periodHours}
      </p>
    </Panel>
  )
}

export function AgentsPanel(props: {
  readonly title: string
  readonly titleKey: string
  readonly view: HudView
  readonly onHire: () => void
}): ReactElement {
  return (
    <Panel id="agents" title={props.title} titleKey={props.titleKey}>
      {props.view.agentsKind === "unavailable" ? (
        <UnavailableState textKey="UI_AGENTS_UNAVAILABLE" text={props.view.agentsEmpty} />
      ) : null}
      {props.view.agentsKind === "ready"
        ? props.view.agents.map((a) => (
            <div key={a.id} data-key={a.idleKey} className="hud-row">
              {a.idleText}
            </div>
          ))
        : null}
      {props.view.agentsKind === "empty" ? <Empty textKey="UI_EMPTY_NO_ENTITIES" text={props.view.agentsEmpty} /> : null}
      <button type="button" className="hud-hire hud-btn hud-btn--primary" data-key="UI_HIRE" onClick={props.onHire}>
        {props.view.hireText}
      </button>
    </Panel>
  )
}

export function LogPanel(props: {
  readonly title: string
  readonly titleKey: string
  readonly view: HudView
  readonly extra: readonly { readonly id: string; readonly key: string; readonly text: string }[]
  readonly onBadge: (id: string) => void
  readonly openId: string
}): ReactElement {
  const rows = [...props.view.log, ...props.extra.map((a) => ({
    id: a.id,
    key: a.key,
    text: a.text,
    badgeKey: "UI_ATTEST_LOGGED",
    badgeText: "",
    root: "",
    cid: "",
  }))]
  return (
    <Panel id="log" title={props.title} titleKey={props.titleKey}>
      {rows.map((a) => (
        <div key={a.id} data-key={a.key} className="hud-log">
          <span>{a.text}</span>
          {a.badgeText.length > 0 ? (
            <button
              type="button"
              data-attest={a.badgeKey}
              onClick={() => {
                props.onBadge(a.id)
              }}
            >
              {a.badgeText}
            </button>
          ) : null}
          {props.openId === a.id ? (
            <div data-key="UI_ATTEST_PROOF">
              <span data-field="root">{a.root}</span>
              <span data-field="cid">{a.cid}</span>
            </div>
          ) : null}
        </div>
      ))}
      {rows.length === 0 ? <Empty textKey="UI_EMPTY_NO_ENTITIES" text={props.view.logEmpty} /> : null}
    </Panel>
  )
}

export function DistrictOverview(props: {
  readonly title: string
  readonly titleKey: string
  readonly rows: HudView["districts"]
  readonly onLook: (id: string) => void
}): ReactElement {
  return (
    <Panel id="schema" title={props.title} titleKey={props.titleKey}>
      <div className="hud-schema">
        {props.rows.map((d) => (
          <div
            key={d.id}
            data-district={d.id}
            data-ticker={d.ticker}
            className="hud-schema__cell"
            onClick={() => {
              props.onLook(d.id)
            }}
          >
            {d.ticker}
          </div>
        ))}
      </div>
    </Panel>
  )
}
