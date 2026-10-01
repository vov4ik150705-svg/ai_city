import { Agents } from "../blocks/Agents"
import { Buildings } from "../blocks/Buildings"
import { Economy } from "../blocks/economy/Economy"
import { Game } from "../blocks/Game"
import { Hero } from "../blocks/Hero"
import { Industries } from "../blocks/Industries"
import { Leaderboard } from "../blocks/Leaderboard"
import { Rating } from "../blocks/Rating"

export function Landing() {
  return (
    <>
      <Hero />
      <Game />
      <Industries />
      <Buildings />
      <Agents />
      <Economy />
    </>
  )
}

export function RatingPage() {
  return <Rating />
}

export function LeaderboardPage() {
  return <Leaderboard />
}

export function NotFound() {
  return (
    <section className="site-section" data-theme="light">
      <div className="site-container">
        <h1 className="type-display-2">Page not found</h1>
      </div>
    </section>
  )
}
