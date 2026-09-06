import type { ReactElement } from "react"
import { lookup } from "../../strings.js"
import { blockingRefusal, Refusal } from "../parts/refusal.js"
import { ScreenFrame, type ScreenProps } from "../parts/ScreenFrame.js"

export function BuildScreen(props: ScreenProps): ReactElement {
  const used = new Set<string>()
  const action = props.pack.actions["build_place"]
  const hit =
    action === undefined
      ? { code: undefined, rest: [] as const }
      : blockingRefusal({
          action,
          capabilities: props.pack.capabilities,
          demo: props.demo,
          isolated: props.pack.demoIsolated,
          failed: props.failed,
          showCount: props.pack.refusalShowCount,
        })
  const blocked = hit.code !== undefined
  const codeText = hit.code === undefined ? "" : lookup(props.strings, hit.code, used)
  return (
    <ScreenFrame
      id="build"
      view={props.view}
      loading={props.loading}
      empty={props.pack.catalog.length === 0}
      onClose={props.onClose}
    >
      {blocked && hit.code !== undefined ? <Refusal code={hit.code} text={codeText} rest={hit.rest} /> : null}
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
                disabled={blocked}
                onClick={() => {
                  if (blocked) return
                  props.onCommit("build", {
                    building_id: row.id,
                    tile_x: props.pendingTileX,
                    tile_y: props.pendingTileY,
                  })
                }}
              >
                {label}
              </button>
            </li>
          )
        })}
      </ul>
    </ScreenFrame>
  )
}
