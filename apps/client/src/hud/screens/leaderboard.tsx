import { useState, type ReactElement } from "react"
import { format, lookup } from "../../strings.js"
import type { ClientPack } from "../../packview.js"
import { TickerMark } from "../parts/TickerMark.js"
import { displayDistrictRole } from "../parts/IndustryCard.js"
import { ActionButton } from "../parts/ActionButton.js"
import { EmptyState, UnavailableState } from "../parts/Empty.js"
import { HudIcon } from "../parts/HudIcon.js"
import { ScreenFrame, type ScreenProps } from "../parts/ScreenFrame.js"
import { groupDigits } from "../parts/si.js"
import { WorkspaceTabs } from "../parts/WorkspaceTabs.js"

type SeasonTab = "overview" | "ranking" | "board" | "claims"

type TableRow = {
  readonly rank: string
  readonly wallet: string
  readonly walletLabel: string
  readonly influence: string
  readonly influenceExact: string
  readonly gdp: string
  readonly gdpExact: string
  readonly qualified: boolean
  readonly self: boolean
  readonly payout?: string
  readonly payoutExact?: string
}

function SeasonTable(props: {
  readonly caption: string
  readonly captionKey: string
  readonly hint: string
  readonly hintKey: string
  readonly empty: boolean
  readonly emptyKey: string
  readonly emptyText: string
  readonly rankLabel: string
  readonly walletLabel: string
  readonly influenceLabel: string
  readonly fourthLabel: string
  readonly fourthKey: string
  readonly youLabel: string
  readonly rows: readonly TableRow[]
  readonly fourth: (row: TableRow) => { readonly text: string; readonly exact: string }
}): ReactElement {
  return (
    <div role="tabpanel" className="hud-card hud-season-table">
      <p data-key={props.hintKey} className="hud-season-table__hint">
        <HudIcon glyph="info" size="sm" />
        <span>{props.hint}</span>
      </p>
      {props.empty ? <EmptyState textKey={props.emptyKey} text={props.emptyText} /> : null}
      <table className="hud-table" data-empty={props.empty ? "1" : "0"}>
        <colgroup>
          <col className="hud-season-table__col-rank" />
          <col className="hud-season-table__col-wallet" />
          <col className="hud-season-table__col-num" />
          <col className="hud-season-table__col-gdp" />
        </colgroup>
        <caption className="hud-sr" data-key={props.captionKey}>
          {props.caption}
        </caption>
        <thead>
          <tr>
            <th data-key="UI_RANK_MARK">{props.rankLabel}</th>
            <th data-key="UI_WALLET">{props.walletLabel}</th>
            <th data-key="UI_INFLUENCE">{props.influenceLabel}</th>
            <th data-key={props.fourthKey}>{props.fourthLabel}</th>
          </tr>
        </thead>
        <tbody>
          {props.rows.map((row) => {
            const fourth = props.fourth(row)
            return (
              <tr
                key={row.wallet}
                className={row.self ? "hud-table__row hud-table__row--self" : "hud-table__row"}
                data-rank={row.rank}
                data-wallet={row.wallet}
                data-self={row.self ? "1" : "0"}
                data-qualified={row.qualified ? "1" : "0"}
              >
                <td data-key="UI_RANK" className="hud-table__rank">
                  {row.rank}
                </td>
                <td>
                  <span className="hud-season-table__who">
                    <span data-key="UI_WALLET">
                      {row.walletLabel}
                    </span>
                    {row.self ? (
                      <span data-key="UI_YOU" className="hud-chip hud-chip--you">
                        {props.youLabel}
                      </span>
                    ) : null}
                  </span>
                </td>
                <td data-key="UI_INFLUENCE" data-exact={row.influenceExact}>
                  {row.influence}
                </td>
                <td data-key={props.fourthKey} data-exact={fourth.exact}>
                  {fourth.text}
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

function PrizeBoard(props: {
  readonly title: string
  readonly caption: string
  readonly hint: string
  readonly empty: boolean
  readonly emptyText: string
  readonly rankLabel: string
  readonly walletLabel: string
  readonly influenceLabel: string
  readonly shareLabel: string
  readonly youLabel: string
  readonly rows: readonly TableRow[]
  readonly rankText: string
  readonly rankExact: string
  readonly rankedLabel: string
  readonly unrankedTitle: string
  readonly unrankedBody: string
  readonly slot: string
}): ReactElement {
  return (
    <div className="hud-prize-board">
      <div className="hud-prize-board__head">
        <p data-key="UI_INFLUENCE_RANK" className="hud-prize-board__title">
          {props.title}
        </p>
        <p data-key="UI_LEADERBOARD_HINT" className="hud-sr">
          {props.hint}
        </p>
      </div>
      {props.empty ? (
        <div className="hud-sr">
          <EmptyState textKey="UI_EMPTY_NO_ENTITIES" text={props.emptyText} />
        </div>
      ) : null}
      <table className="hud-table" data-empty={props.empty ? "1" : "0"}>
        <colgroup>
          <col className="hud-prize-board__col-rank" />
          <col className="hud-prize-board__col-badge" />
          <col className="hud-prize-board__col-mark" />
          <col />
          <col className="hud-prize-board__col-score" />
        </colgroup>
        <caption className="hud-sr" data-key="UI_LEADERBOARD">
          {props.caption}
        </caption>
        <thead>
          <tr>
            <th data-key="UI_RANK_MARK">{props.rankLabel}</th>
            <th aria-hidden="true" />
            <th aria-hidden="true" />
            <th data-key="UI_WALLET">{props.walletLabel}</th>
            <th data-key="UI_INFLUENCE">{props.influenceLabel}</th>
          </tr>
        </thead>
        <tbody>
          {props.rows.map((row) => {
            const share = row.payout === undefined || row.payout.length === 0 ? DASH : row.payout
            const exact = row.payoutExact === undefined ? "" : row.payoutExact
            const first = row.rank === "1" ? " hud-prize-board__row--first" : ""
            const self = row.self ? " hud-table__row--self" : ""
            return (
              <tr
                key={row.wallet}
                className={`hud-table__row${self}${first}`}
                data-rank={row.rank}
                data-wallet={row.wallet}
                data-self={row.self ? "1" : "0"}
                data-qualified={row.qualified ? "1" : "0"}
              >
                <td data-key="UI_RANK" className="hud-prize-board__rank">
                  {row.rank}
                </td>
                <td className="hud-prize-board__badge hud-prize-board__badge--crown">
                  {row.rank === "1" ? <HudIcon glyph="crown" size="sm" /> : null}
                </td>
                <td className="hud-prize-board__badge hud-prize-board__badge--shield">
                  <HudIcon glyph="shield" size="sm" />
                </td>
                <td>
                  <span className="hud-prize-board__who">
                    <span data-key="UI_WALLET">{row.walletLabel}</span>
                    {row.self ? (
                      <span data-key="UI_YOU" className="hud-chip hud-chip--you">
                        {props.youLabel}
                      </span>
                    ) : null}
                  </span>
                </td>
                <td className="hud-prize-board__score">
                  <span data-key="UI_INFLUENCE" data-exact={row.influenceExact}>
                    {row.influence}
                  </span>
                  {share === DASH ? null : (
                    <span data-key="UI_PRIZE_SHARE" data-exact={exact} className="hud-prize-board__share">
                      <span className="hud-sr">{props.shareLabel}</span>
                      {share}
                    </span>
                  )}
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
      <div className="hud-prize-board__status">
        <span className="hud-prize-board__mark">
          <HudIcon glyph="info" size="sm" />
        </span>
        <span aria-hidden="true" />
        <span className="hud-prize-board__badge hud-prize-board__badge--shield">
          <HudIcon glyph="trophy" size="sm" />
        </span>
        {props.rankText.length > 0 ? (
          <div>
            <p data-key="UI_YOUR_RANK" className="hud-prize-board__status-t">
              {props.rankedLabel}
            </p>
            <p className="hud-prize-board__status-v" data-exact={props.rankExact}>
              {props.rankText}
            </p>
          </div>
        ) : (
          <div>
            <p data-key="UI_NOT_RANKED_YET" className="hud-prize-board__status-t">
              {props.unrankedTitle}
            </p>
            {props.unrankedBody.length > 0 ? (
              <p data-key="UI_BOARD_UNQUALIFIED" className="hud-prize-board__status-s">
                {props.unrankedBody}
              </p>
            ) : null}
          </div>
        )}
      </div>
      <p data-key="UI_PRIZE_SLOT" className="hud-prize-board__slot">
        <span aria-hidden="true" />
        <span aria-hidden="true" />
        <span className="hud-prize-board__badge">
          <HudIcon glyph="purse" size="sm" />
        </span>
        <span>{props.slot}</span>
      </p>
    </div>
  )
}

function shownRank(qualified: boolean, rank: bigint | undefined): { readonly text: string; readonly exact: string } {
  if (!qualified || rank === undefined || rank <= 0n) return { text: "", exact: "" }
  return { text: groupDigits(rank), exact: rank.toString() }
}

export function LeaderboardScreen(props: ScreenProps): ReactElement {
  const qualified = props.view.influenceQualified === true
  const place = shownRank(qualified, props.view.influenceRankNumber)
  const [tab, setTab] = useState<SeasonTab>(qualified ? "ranking" : "overview")
  const used = new Set<string>()
  const t = (key: string): string => lookup(props.strings, key, used)
  const board = props.view.liveBoard
  const prize = props.view.prizeBoard
  const empty = board.length === 0
  const prizeEmpty = prize.length === 0
  const basketEmpty = props.view.basket.length === 0
  const tabs = [
    { id: "ranking" as const, key: "UI_LIVE_BOARD", label: t("UI_LIVE_BOARD") },
    { id: "board" as const, key: "UI_LEADERBOARD", label: t("UI_LEADERBOARD") },
    { id: "claims" as const, key: "UI_REWARDS", label: t("UI_REWARDS") },
    { id: "overview" as const, key: "UI_OVERVIEW", label: t("UI_OVERVIEW") },
  ]
  const period = props.view.periodLabel
  const season = props.view.seasonLabel
  const seasonNo = indexedLabel(season, "S")
  const periodNo = indexedLabel(period, "P")
  return (
    <ScreenFrame id="leaderboard" view={props.view} loading={props.loading} empty={false} onClose={props.onClose}>
      <div className="hud-season-head">
        <HudIcon glyph="trophy" size="lg" />
        <div className="hud-season-head__copy">
          <div className="hud-season-head__row">
            <p className="hud-season-head__title">
              {seasonNo !== undefined ? (
                <>
                  <span data-key="UI_SEASON">{t("UI_SEASON")}</span> <span data-field="seasonLabel" data-season={season}>{seasonNo}</span>
                </>
              ) : season.length > 0 ? (
                <span data-field="seasonLabel" data-season={season}>{season}</span>
              ) : (
                <span data-key={props.view.shell.season.key}>{props.view.shell.season.text}</span>
              )}
            </p>
            {period.length > 0 ? (
              <span data-key="UI_SEASON_ACTIVE" className="hud-season-head__live">
                {t("UI_SEASON_ACTIVE")}
              </span>
            ) : null}
          </div>
          {period.length > 0 ? (
            <p data-key="UI_PERIOD" data-period={props.view.periodHours} className="hud-season-head__period">
              {t("UI_PERIOD")}{" "}
              <span data-field="periodLabel" data-period-label={period}>{periodNo ?? period}</span>
            </p>
          ) : (
            <UnavailableState textKey="UI_UNAVAILABLE" text={t("UI_UNAVAILABLE")} />
          )}
        </div>
      </div>
      <WorkspaceTabs
        label={t("UI_LEADERBOARD")}
        tabPrefix="hud-tab-season-"
        panelId={(id) => `hud-panel-season-${id}`}
        tabs={tabs}
        active={tab}
        onPick={setTab}
      />
      {tab === "overview" ? (
        <div role="tabpanel" id="hud-panel-season-overview" aria-labelledby="hud-tab-season-overview">
          <QualifyOverview
            title={t("UI_NOT_QUALIFIED_YET")}
            open={t("UI_QUALIFY_OPEN")}
            foot={t("UI_EMPTY_NOT_QUALIFIED")}
            positiveLabel={t("UI_POSITIVE_DAYS")}
            influenceLabel={t("UI_INFLUENCE")}
            prizeLabel={t("UI_PRIZE")}
            notEligible={t("UI_NOT_ELIGIBLE")}
            lead={t("UI_QUALIFY_LEAD")}
            daysRule={format(t("UI_QUALIFY_DAYS"), { count: groupDigits(props.pack.qualifyDays) })}
            stakeRule={t("UI_QUALIFY_STAKE")}
            positiveDays={props.view.influencePositiveDays}
            qualifyDays={props.pack.qualifyDays}
          />
        </div>
      ) : null}
      {tab === "ranking" ? (
        <div role="tabpanel" id="hud-panel-season-ranking" aria-labelledby="hud-tab-season-ranking">
          <SeasonTable
            caption={t("UI_RANKING")}
            captionKey="UI_RANKING"
            hint={t("UI_RANKING_HINT")}
            hintKey="UI_RANKING_HINT"
            empty={empty}
            emptyKey="UI_EMPTY_NO_ENTITIES"
            emptyText={props.view.agentsEmpty}
            rankLabel={t("UI_RANK_MARK")}
            walletLabel={t("UI_WALLET")}
            influenceLabel={t("UI_INFLUENCE")}
            fourthLabel={t("UI_GDP")}
            fourthKey="UI_GDP"
            youLabel={t("UI_YOU")}
            rows={board}
            fourth={(row) => ({ text: row.gdp, exact: row.gdpExact })}
          />
        </div>
      ) : null}
      {tab === "board" ? (
        <div role="tabpanel" id="hud-panel-season-board" aria-labelledby="hud-tab-season-board">
          <PrizeBoard
            title={t("UI_INFLUENCE_RANK")}
            caption={t("UI_LEADERBOARD")}
            hint={t("UI_LEADERBOARD_HINT")}
            empty={prizeEmpty}
            emptyText={props.view.agentsEmpty}
            rankLabel={t("UI_RANK_MARK")}
            walletLabel={t("UI_WALLET")}
            influenceLabel={t("UI_INFLUENCE")}
            shareLabel={t("UI_PRIZE_SHARE")}
            youLabel={t("UI_YOU")}
            rows={prize}
            rankText={place.text}
            rankExact={place.exact}
            rankedLabel={t("UI_YOUR_RANK")}
            unrankedTitle={t("UI_NOT_RANKED_YET")}
            unrankedBody={qualified ? "" : t("UI_BOARD_UNQUALIFIED")}
            slot={t("UI_PRIZE_SLOT")}
          />
        </div>
      ) : null}
      {tab === "claims" ? (
        <div role="tabpanel" id="hud-panel-season-claims" aria-labelledby="hud-tab-season-claims">
          <PrizeRewards
            pack={props.pack}
            basket={props.view.basket}
            qualified={props.view.influenceQualified === true}
            rank={props.view.influenceRankNumber}
            rankLabel={t("UI_YOUR_RANK")}
            notRanked={t("UI_NOT_RANKED")}
            basketLabel={t("UI_PRIZE_BASKET_TITLE")}
            stockLabel={t("UI_STOCK_TOKENS")}
            nameOf={(ticker) => {
              const key = stockNameKey(ticker)
              return key === undefined ? undefined : t(key)
            }}
            gate={format(t("UI_PRIZE_GATE"), { count: groupDigits(props.pack.qualifyDays) })}
            pays={t("UI_PRIZE_PAYS_STOCKS")}
            notice={props.view.prizeNotice}
            empty={basketEmpty && props.pack.prizeAssets.length === 0}
            emptyText={props.view.agentsEmpty}
            claim={<ActionButton {...props} actionId="leaderboard_claim" keepLabel />}
          />
        </div>
      ) : null}
    </ScreenFrame>
  )
}

const DASH = "—"

function indexedLabel(label: string, prefix: string): string | undefined {
  if (!label.startsWith(prefix)) return undefined
  const rest = label.slice(prefix.length)
  if (rest.length === 0 || !/^[0-9]+$/.test(rest)) return undefined
  return rest.padStart(2, "0")
}

function QualifyOverview(props: {
  readonly title: string
  readonly open: string
  readonly foot: string
  readonly positiveLabel: string
  readonly influenceLabel: string
  readonly prizeLabel: string
  readonly notEligible: string
  readonly lead: string
  readonly daysRule: string
  readonly stakeRule: string
  readonly positiveDays: bigint | undefined
  readonly qualifyDays: bigint
}): ReactElement {
  const days = props.positiveDays
  return (
    <div className="hud-season-qualify" data-qualified="0">
      <div className="hud-season-qualify__hero">
        <HudIcon glyph="trophy" size="lg" />
        <p data-key="UI_NOT_QUALIFIED_YET" className="hud-season-qualify__title">
          {props.title}
        </p>
        <p data-key="UI_QUALIFY_OPEN" className="hud-season-qualify__open">
          {props.open}
        </p>
      </div>
      <div className="hud-season-qualify__tiles">
        <div className="hud-season-qualify__tile">
          <span data-key="UI_POSITIVE_DAYS" className="hud-season-qualify__k">
            <HudIcon glyph="time" size="sm" />
            {props.positiveLabel}
          </span>
          <span className="hud-season-qualify__v">
            {days === undefined ? (
              <span data-key="UI_UNAVAILABLE">{DASH}</span>
            ) : (
              <span data-exact={days.toString()}>{groupDigits(days)}</span>
            )}
            <span aria-hidden="true"> / </span>
            {days === undefined ? (
              <span data-key="UI_UNAVAILABLE">{DASH}</span>
            ) : (
              <span data-exact={props.qualifyDays.toString()}>{groupDigits(props.qualifyDays)}</span>
            )}
          </span>
        </div>
        <div className="hud-season-qualify__tile">
          <span data-key="UI_INFLUENCE" className="hud-season-qualify__k">
            <HudIcon glyph="gauge" size="sm" />
            {props.influenceLabel}
          </span>
          <span data-key="UI_UNAVAILABLE" className="hud-season-qualify__v">
            {DASH}
          </span>
        </div>
        <div className="hud-season-qualify__tile">
          <span data-key="UI_PRIZE" className="hud-season-qualify__k">
            <HudIcon glyph="trophy" size="sm" />
            {props.prizeLabel}
          </span>
          <span className="hud-season-qualify__v hud-season-qualify__v--stack">
            <span data-key="UI_UNAVAILABLE">{DASH}</span>
            <span data-key="UI_NOT_ELIGIBLE" className="hud-season-qualify__sub">
              {props.notEligible}
            </span>
          </span>
        </div>
      </div>
      <div className="hud-season-qualify__note">
        <HudIcon glyph="info" size="sm" />
        <div>
          <p data-key="UI_QUALIFY_LEAD" className="hud-season-qualify__lead">
            {props.lead}
          </p>
          <ul>
            <li data-key="UI_QUALIFY_DAYS">{props.daysRule}</li>
            <li data-key="UI_QUALIFY_STAKE">{props.stakeRule}</li>
          </ul>
        </div>
      </div>
      <p data-key="UI_EMPTY_NOT_QUALIFIED" className="hud-season-qualify__foot">
        <HudIcon glyph="info" size="sm" />
        <span>{props.foot}</span>
      </p>
    </div>
  )
}

function stockNameKey(ticker: string): string | undefined {
  switch (ticker) {
    case "NVDA":
      return "UI_STOCK_NVDA"
    case "TSLA":
      return "UI_STOCK_TSLA"
    case "AMZN":
      return "UI_STOCK_AMZN"
    case "AAPL":
      return "UI_STOCK_AAPL"
    case "MSFT":
      return "UI_STOCK_MSFT"
    case "COIN":
      return "UI_STOCK_COIN"
    default:
      return undefined
  }
}

function prizeAmount(month: string | undefined): { readonly text: string; readonly exact: string } {
  if (month === undefined || !/^[0-9]+$/.test(month)) return { text: DASH, exact: "" }
  const n = BigInt(month)
  if (n <= 0n) return { text: DASH, exact: month }
  return { text: groupDigits(n), exact: month }
}

function PrizeRewards(props: {
  readonly pack: ClientPack
  readonly basket: ScreenProps["view"]["basket"]
  readonly qualified: boolean
  readonly rank: bigint | undefined
  readonly rankLabel: string
  readonly notRanked: string
  readonly basketLabel: string
  readonly stockLabel: string
  readonly nameOf: (ticker: string) => string | undefined
  readonly gate: string
  readonly pays: string
  readonly notice: ScreenProps["view"]["prizeNotice"]
  readonly empty: boolean
  readonly emptyText: string
  readonly claim: ReactElement
}): ReactElement {
  const rank = props.qualified && props.rank !== undefined && props.rank > 0n ? props.rank : undefined
  const monthOf = new Map(props.basket.map((row) => [row.ticker, row.month]))
  return (
    <div className="hud-season-rewards">
      <div className="hud-season-rewards__top">
        <div className="hud-season-rewards__rank">
          <span className="hud-season-rewards__k">
            <HudIcon glyph="award" size="md" />
            <span data-key="UI_YOUR_RANK">{props.rankLabel}</span>
          </span>
          <span data-key={rank === undefined ? "UI_UNAVAILABLE" : "UI_RANK"} className="hud-season-rewards__rank-v" data-exact={rank === undefined ? "" : rank.toString()}>
            {rank === undefined ? DASH : groupDigits(rank)}
          </span>
          {rank !== undefined ? null : (
            <span data-key="UI_NOT_RANKED" className="hud-season-rewards__sub">
              {props.notRanked}
            </span>
          )}
        </div>
        {props.qualified ? null : (
          <div className="hud-season-rewards__gate">
            <span className="hud-season-rewards__mark">
              <HudIcon glyph="info" size="sm" />
            </span>
            <p data-key="UI_PRIZE_GATE">{props.gate}</p>
          </div>
        )}
      </div>
      <p data-key="UI_PRIZE_BASKET_TITLE" className="hud-season-rewards__h">
        {props.basketLabel}
      </p>
      {props.empty ? <EmptyState textKey="UI_EMPTY_NO_ENTITIES" text={props.emptyText} /> : null}
      {props.notice !== undefined ? (
        <p data-key={props.notice.key} className="hud-muted">
          {props.notice.text}
        </p>
      ) : null}
      <ul className="hud-season-rewards__list">
        {props.pack.prizeAssets.map((ticker) => {
          const district = props.pack.districts.find((row) => row.ticker === ticker)
          const amount = prizeAmount(monthOf.get(ticker))
          const nameKey = stockNameKey(ticker)
          const named = nameKey === undefined ? undefined : props.nameOf(ticker)
          return (
            <li key={ticker} className="hud-season-rewards__row" data-ticker={ticker}>
              <TickerMark ticker={ticker} className="hud-season-rewards__logo" />
              <span className="hud-season-rewards__name">
                <span className="hud-season-rewards__ticker">{ticker}</span>
                <span className="hud-season-rewards__role" {...(nameKey === undefined ? {} : { "data-key": nameKey })}>
                  {named ?? (district === undefined ? DASH : displayDistrictRole(district.role))}
                </span>
              </span>
              <span className="hud-season-rewards__tail">
                <span className="hud-season-rewards__amt" data-exact={amount.exact} data-key="UI_CLAIM_PRIZE">
                  {amount.text}
                </span>
                <span data-key="UI_STOCK_TOKENS" className="hud-season-rewards__unit">
                  {props.stockLabel}
                </span>
                <HudIcon glyph="forward" size="sm" />
              </span>
            </li>
          )
        })}
      </ul>
      <div className="hud-season-rewards__claim">{props.claim}</div>
      <p data-key="UI_PRIZE_PAYS_STOCKS" className="hud-season-rewards__pays">
        <span className="hud-season-rewards__mark">
          <HudIcon glyph="info" size="sm" />
        </span>
        <span>{props.pays}</span>
      </p>
    </div>
  )
}
