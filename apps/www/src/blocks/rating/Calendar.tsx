import type { CSSProperties } from "react"
import { Calendar as CalendarIcon, Coins, Snowflake, Warehouse, type LucideIcon } from "lucide-react"
import { cityDayRealHours, clockCells, clockCopy, type ClockCellId } from "../../data/clocks"
import { fill } from "./fill"
import { SectionHead } from "./SectionHead"

const clockIcon: Record<ClockCellId, LucideIcon> = {
  "city-day": CalendarIcon,
  farm: Warehouse,
  prize: Coins,
  season: Snowflake,
}

const seasonDays = Math.max(...clockCells.map((cell) => cell.days))
const periodCell = clockCells.find((cell) => cell.id === "prize")
const periodDays = periodCell === undefined ? seasonDays : periodCell.days
const periodSlices = periodDays === 0 ? 0 : Math.floor(seasonDays / periodDays)
const periodMarks = Array.from({ length: periodSlices }, (_, index) => (index + 1) * periodDays)
const shortSpans = clockCells.map((cell) => cell.days).filter((days) => days > 1 && days < periodDays)
const axisDays = [...new Set([0, ...shortSpans, ...periodMarks])].sort((a, b) => a - b)

function at(days: number): CSSProperties {
  return { "--at": seasonDays === 0 ? 0 : days / seasonDays } as CSSProperties
}

function spanText(days: number): string {
  const hours = days * cityDayRealHours
  return fill(days === 1 ? clockCopy.oneDay : clockCopy.span, { days, hours })
}

export function Calendar() {
  return (
    <section id="rating-calendar" className="rsec" aria-labelledby="rating-calendar-title">
      <SectionHead id="rating-calendar-title" eyebrow={clockCopy.eyebrow} title={clockCopy.title} lead={clockCopy.lead} />
      <div className="rcal">
        <ul className="rcal__rows">
          {clockCells.map((cell) => {
            const Icon = clockIcon[cell.id]
            return (
              <li key={cell.id} className={`rcal__row is-${cell.id}`}>
                <span className="rcal__label">
                  <span className="rating-mark" aria-hidden="true">
                    <Icon size={16} />
                  </span>
                  <span>
                    <span className="type-label">{cell.label}</span>
                    <span className="type-caption">{spanText(cell.days)}</span>
                  </span>
                </span>
                <span className="rcal__track" aria-hidden="true">
                  <span className="rcal__bar" style={at(cell.days)}>
                    {cell.id === "season"
                      ? Array.from({ length: periodSlices }, (_, index) => <span key={index} className="rcal__slice" />)
                      : null}
                  </span>
                </span>
                <span className="rcal__text type-body-sm">{cell.text}</span>
              </li>
            )
          })}
        </ul>
        <div className="rcal__axis type-caption" aria-hidden="true">
          <span className="rcal__axis-name">{clockCopy.axis}</span>
          <span className="rcal__axis-track">
            {axisDays.map((days) => (
              <span key={days} className="rcal__axis-tick" style={at(days)}>
                {days}
              </span>
            ))}
          </span>
        </div>
      </div>
    </section>
  )
}
