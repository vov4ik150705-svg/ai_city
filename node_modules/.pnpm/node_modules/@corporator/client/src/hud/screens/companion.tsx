import type { ReactElement } from "react"
import { codes } from "@corporator/protocol"
import { lookup } from "../../strings.js"
import { ActionButton } from "../parts/ActionButton.js"
import { ScreenFrame, type ScreenProps } from "../parts/ScreenFrame.js"
import { Value } from "../parts/Value.js"

export function journalMatchesCompanion(key: string, needle: string): boolean {
  if (key === codes.DEMO_NO_COMPANION) return true
  return needle.length > 0 && key.startsWith(needle)
}

export function filterNeedle(effect: string): string {
  const prefix = "filter:"
  if (!effect.startsWith(prefix)) return ""
  return effect.slice(prefix.length)
}

export function autopilotJournalCode(nextOn: boolean): string {
  return nextOn ? codes.COMPANION_ACTED : codes.COMPANION_OFF
}

export function CompanionScreen(props: ScreenProps): ReactElement {
  const used = new Set<string>()
  const pack = props.pack
  const filter = pack.actions["companion_filter"]
  const needle = filter === undefined ? "" : filterNeedle(filter.effect)
  const relief = pack.companionReliefBps.toString()
  const cmdCap = pack.companionCmdPerTick.toString()
  const depth = pack.companionAdvisorDepth.toString()
  const calls = pack.companionAdvisorCalls.toString()
  const cool = pack.companionAdvisorCooldown.toString()
  const windowCap = pack.companionOfflineCap.toString()
  const log = [...props.view.log, ...props.journalExtra].filter((row) =>
    journalMatchesCompanion(row.key, needle),
  )
  return (
    <ScreenFrame id="companion" view={props.view} loading={props.loading} empty={false} onClose={props.onClose}>
      <div className="hud-companion" data-autopilot={props.autopilotOn ? "1" : "0"}>
        <p data-key="UI_PERSONA">{lookup(props.strings, "UI_PERSONA", used)}</p>
        <p data-key="UI_IDLE_RELIEF">
          {lookup(props.strings, "UI_IDLE_RELIEF", used)}{" "}
          <Value display={relief} exact={relief} />
        </p>
        <p data-key="UI_COMPANION_WINDOW">
          {lookup(props.strings, "UI_COMPANION_WINDOW", used)}{" "}
          <Value display={windowCap} exact={windowCap} />
        </p>
        {pack.companionCarryOver === 0n ? (
          <p data-key="UI_COMPANION_CARRY">{lookup(props.strings, "UI_COMPANION_CARRY", used)}</p>
        ) : null}
        <p data-key="UI_COMPANION_LIMITS">
          {lookup(props.strings, "UI_COMPANION_LIMITS", used)} {cmdCap} {depth} {calls} {cool}
        </p>
        <p data-key="UI_ADVISOR_CALLS">
          {lookup(props.strings, "UI_ADVISOR_CALLS", used)}{" "}
          <Value display={calls} exact={calls} />
        </p>
        <ul className="hud-list" data-key="UI_COMPANION_COMMANDS">
          {pack.companionCommands.map((cmd) => (
            <li key={cmd.id} data-command={cmd.id}>
              {cmd.id}
            </li>
          ))}
        </ul>
        <ActionButton {...props} actionId="companion_toggle" />
        <ActionButton {...props} actionId="companion_ask_advisor" />
        <ActionButton {...props} actionId="companion_filter" />
        <div data-journal="companion">
          {log.map((row) => (
            <div key={row.id} data-key={row.key} className="hud-log">
              {row.text}
            </div>
          ))}
        </div>
      </div>
    </ScreenFrame>
  )
}
