import { useState, type ReactElement } from "react"
import { lookup } from "../../strings.js"
import { evaluateActionGate } from "../gates.js"
import { PackCost } from "../parts/PackCost.js"
import { Refusal, refusalFromIntent, shownRefusalText } from "../parts/refusal.js"
import { ScreenFrame, type ScreenProps } from "../parts/ScreenFrame.js"

export function BuildScreen(props: ScreenProps): ReactElement {
  const [buildRefusal, setBuildRefusal] = useState<{ readonly id: string; readonly code: string } | undefined>(undefined)
  const used = new Set<string>()
  const action = props.pack.actions["build_place"]
  const gate =
    action === undefined
      ? { kind: "ok" as const }
      : evaluateActionGate({
          pack: props.pack,
          action,
          view: props.view,
          demo: props.demo,
          extraFailed: props.failed,
          lookId: props.lookId,
        })
  const blocked = gate.kind !== "ok"
  const refusalCode = gate.kind === "blocked" ? gate.refusal.code : undefined
  const refusalRest = gate.kind === "blocked" ? gate.refusal.rest : []
  const codeText = refusalCode === undefined ? "" : lookup(props.strings, refusalCode, used)
  const unavailable = lookup(props.strings, "UI_UNAVAILABLE", used)
  return (
    <ScreenFrame
      id="build"
      view={props.view}
      loading={props.loading}
      empty={props.pack.catalog.length === 0}
      onClose={props.onClose}
    >
      {gate.kind === "missing" ? (
        <span data-key="UI_UNAVAILABLE" data-gate="missing" className="hud-unavailable">
          {unavailable}
        </span>
      ) : blocked && refusalCode !== undefined ? (
        <Refusal code={refusalCode} text={codeText} rest={refusalRest} />
      ) : null}
      <ul className="hud-list">
        {props.pack.catalog.map((row) => {
          const key = "UI_BLD_" + row.id.toUpperCase()
          const label = lookup(props.strings, key, used)
          return (
            <li key={row.id}>
              <button
                type="button"
                data-building={row.id}
                data-action="build_place"
                data-gate={gate.kind}
                disabled={blocked}
                onClick={() => {
                  if (blocked) return
                  const pending = props.onIntent(
                    { kind: "build", buildingId: row.id },
                    {
                      building_id: row.id,
                    },
                  )
                  void refusalFromIntent(pending).then((code) => {
                    setBuildRefusal(code.length === 0 ? undefined : { id: row.id, code })
                  })
                }}
              >
                {label}
              </button>
              {buildRefusal !== undefined && buildRefusal.id === row.id ? (
                <Refusal code={buildRefusal.code} text={shownRefusalText(lookup(props.strings, buildRefusal.code, used), buildRefusal.code)} rest={[]} />
              ) : null}
              <PackCost amount={row.cost} label={lookup(props.strings, "UI_CAPITAL_COST", used)} unavailable={unavailable} />
            </li>
          )
        })}
      </ul>
    </ScreenFrame>
  )
}
