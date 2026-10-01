import { Clock, Layers, SearchCheck, Target, type LucideIcon } from "lucide-react"
import { ratingClimb } from "../../data/rating"
import { SectionHead } from "./SectionHead"

const tipIcon: Record<(typeof ratingClimb.tips)[number]["id"], LucideIcon> = {
  work: Layers,
  offline: Clock,
  coverage: Target,
  idle: SearchCheck,
}

export function Climb() {
  return (
    <section id="rating-climb" className="rsec" aria-labelledby="rating-climb-title">
      <SectionHead id="rating-climb-title" eyebrow={ratingClimb.eyebrow} title={ratingClimb.title} />
      <ol className="rclimb">
        {ratingClimb.tips.map((tip, index) => {
          const Icon = tipIcon[tip.id]
          return (
            <li key={tip.id} className="rclimb__item">
              <span className="rclimb__top">
                <span className="rclimb__n type-numeric">{index + 1}</span>
                <span className="rclimb__tag type-label">
                  <Icon size={12} aria-hidden="true" />
                  {tip.tag}
                </span>
              </span>
              <p className="type-body-sm">{tip.text}</p>
            </li>
          )
        })}
      </ol>
    </section>
  )
}
