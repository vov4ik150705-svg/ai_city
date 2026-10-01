import { HandVRule } from "../sketch/Sketch"
import { diagramKey, planDiagram, sectionVisualProblems, type SectionVisual } from "./registry"
import { SketchDay } from "./SketchDay"
import { SketchFlow } from "./SketchFlow"
import { SketchSequence } from "./SketchSequence"
import { SketchState } from "./SketchState"

/** A sheet drawn from the section's prose. It is left out, not faked, when its words stop matching the section. */
export function SectionSheet({ id, visual, sectionText, title }: {
  id: string
  visual: SectionVisual
  sectionText: string
  title: string
}) {
  const problems = sectionVisualProblems(visual, sectionText)
  if (problems.length > 0) {
    if (import.meta.env.DEV) console.warn(`[handbook] ${id}:`, problems)
    return null
  }
  return (
    <figure className="hb-figure">
      <div className="hb-figure__scroll">
        {visual.kind === "state" ? (
          <SketchState id={id} layout={visual.layout} title={title} />
        ) : (
          <SketchDay id={id} layout={visual.layout} title={title} />
        )}
      </div>
    </figure>
  )
}

export function Diagram({ chapter, section, title, source, sectionText }: {
  chapter: string
  section: string
  title: string
  source: string
  sectionText: string
}) {
  const key = diagramKey(chapter, section)
  const plan = planDiagram(key, source, sectionText)

  if (plan.kind === "pending") {
    if (import.meta.env.DEV && plan.problems.length > 0) console.warn(`[handbook] ${key}:`, plan.problems)
    return (
      <aside className="hb-note hb-note--pending">
        <HandVRule seed={`${key}:pending`} />
        <p className="hb-note__label">Diagram in preparation</p>
        <details className="hb-source">
          <summary>Diagram source</summary>
          <pre className="hb-pre">
            <code>{source}</code>
          </pre>
        </details>
      </aside>
    )
  }

  if (plan.kind === "sequence" && import.meta.env.DEV && plan.phaseProblems.length > 0) {
    console.warn(`[handbook] ${key} phases:`, plan.phaseProblems)
  }

  return (
    <figure className="hb-figure">
      <div className="hb-figure__scroll">
        {plan.kind === "flow" ? (
          <SketchFlow id={key} chart={plan.chart} layout={plan.layout} title={title} />
        ) : plan.kind === "state" ? (
          <SketchState id={key} layout={plan.layout} title={title} />
        ) : (
          <SketchSequence id={key} sequence={plan.sequence} phases={plan.phases} title={title} />
        )}
      </div>
    </figure>
  )
}
