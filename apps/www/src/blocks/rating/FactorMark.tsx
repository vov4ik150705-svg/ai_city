import { Cog, Layers, Shield, Target, type LucideIcon } from "lucide-react"
import type { RatingFactorId } from "../../data/rating"

const factorIcon: Record<RatingFactorId, LucideIcon> = {
  gdp: Layers,
  stability: Shield,
  efficiency: Cog,
  coverage: Target,
}

export function FactorMark({ id, size = 18 }: { id: RatingFactorId; size?: number }) {
  const Icon = factorIcon[id]
  return (
    <span className="rating-mark" aria-hidden="true">
      <Icon size={size} />
    </span>
  )
}
