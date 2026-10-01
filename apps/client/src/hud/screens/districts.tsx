import type { ReactElement } from "react"
import { ActionButton } from "../parts/ActionButton.js"
import { ScreenFrame, type ScreenProps } from "../parts/ScreenFrame.js"

export function DistrictsCatalog(
  props: ScreenProps & { readonly onOpenDistrict?: (id: string) => void },
): ReactElement {
  const openDistrict = props.onOpenDistrict
  function openCard(id: string): void {
    if (openDistrict !== undefined) openDistrict(id)
    else props.onNavigate("district_card")
  }
  return (
    <div data-districts-catalog="live">
      <ul className="hud-list" data-open-district="live">
        {props.view.districts.map((d) => {
          const selectId = `districts_select_${d.id}`
          return (
            <li key={d.id}>
              <button type="button" data-district={d.id} onClick={() => openCard(d.id)}>
                {d.ticker}
              </button>
              <ActionButton {...props} actionId="districts_open" lookId={d.id} extra={{ district_id: d.id }} />
              <ActionButton
                {...props}
                actionId="districts_open_card"
                onNavigate={(id) => {
                  if (id === "district_card") openCard(d.id)
                  else props.onNavigate(id)
                }}
              />
              {props.pack.actions[selectId] === undefined ? null : (
                <ActionButton {...props} actionId={selectId} lookId={d.id} />
              )}
            </li>
          )
        })}
      </ul>
      <ActionButton {...props} actionId="districts_to_exchange" />
    </div>
  )
}

export function DistrictsScreen(props: ScreenProps): ReactElement {
  return (
    <ScreenFrame
      id="districts"
      view={props.view}
      loading={props.loading}
      empty={props.view.districts.length === 0}
      onClose={props.onClose}
    >
      <DistrictsCatalog {...props} />
    </ScreenFrame>
  )
}
