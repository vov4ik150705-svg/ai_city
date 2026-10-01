import { edgeKey, type Flowchart } from "../mermaid/flowchart"
import { SkArrow, SkEllipse, SkGuide, SkLine, SkRect } from "../sketch/Sketch"
import { captionLines, type FlowLayout } from "./flowLayout"
import { NoteText } from "./SheetText"

const TITLE_Y = 25
const SUB_Y = 48
const SUB_STEP = 22
const PHRASE_STEP = 26

/** Draws a checked flowchart. Call `checkLayout` first: this component trusts the layout. */
export function SketchFlow({ id, chart, layout, title }: {
  id: string
  chart: Flowchart
  layout: FlowLayout
  title: string
}) {
  return (
    <svg
      className="sk-sheet"
      viewBox={`0 0 ${layout.width} ${layout.height}`}
      role="img"
      aria-label={title}
    >
      {layout.dividers.map((divider, index) => (
        <SkGuide key={`divider-${index}`} from={divider.from} to={divider.to} seed={`${id}:divider:${index}`} />
      ))}

      {layout.lanes.map((lane) => {
        const label = chart.groups.find((group) => group.id === lane.group)?.label ?? lane.group
        return (
          <g key={lane.group}>
            <text className="sk-lane" x={lane.x} y={lane.y}>
              {label}
            </text>
            <SkLine
              from={{ x: lane.x - 2, y: lane.y + 8 }}
              to={{ x: lane.x + label.length * 13, y: lane.y + 7 }}
              seed={`${id}:lane:${lane.group}`}
            />
          </g>
        )
      })}

      {chart.edges.map((edge) => {
        const key = edgeKey(edge.from, edge.to)
        const route = layout.edges[key]
        if (route === undefined) return null
        return (
          <g key={key}>
            <SkArrow points={route.points} both={edge.both} seed={`${id}:edge:${key}`} />
            {route.label === undefined ? null : <NoteText spot={route.label} lines={edge.lines} />}
          </g>
        )
      })}

      {chart.nodes.map((node) => {
        const box = layout.nodes[node.id]
        if (box === undefined) return null
        const cx = box.x + box.w / 2
        const [first = "", ...rest] = (box.caption === true ? captionLines(node.lines) : null) ?? node.lines
        if (node.shape === "circle") {
          return (
            <g key={node.id}>
              <SkEllipse cx={cx} cy={box.y + box.h / 2} rx={box.w / 2} ry={box.h / 2} seed={`${id}:node:${node.id}`} />
              <text className="sk-node" x={cx} y={box.y + box.h / 2 + 6} textAnchor="middle">
                {first}
              </text>
            </g>
          )
        }
        if (box.phrase === true) {
          const top = box.y + box.h / 2 + 6 - ((node.lines.length - 1) * PHRASE_STEP) / 2
          return (
            <g key={node.id}>
              <SkRect x={box.x} y={box.y} w={box.w} h={box.h} seed={`${id}:node:${node.id}`} />
              {node.lines.map((line, index) => (
                <text key={line} className="sk-node" x={cx} y={top + index * PHRASE_STEP} textAnchor="middle">
                  {line}
                </text>
              ))}
            </g>
          )
        }
        const titleY = rest.length === 0 ? box.y + box.h / 2 + 6 : box.y + TITLE_Y
        return (
          <g key={node.id}>
            <SkRect x={box.x} y={box.y} w={box.w} h={box.h} seed={`${id}:node:${node.id}`} />
            <text className="sk-node" x={cx} y={titleY} textAnchor="middle">
              {first}
            </text>
            {rest.map((line, index) => (
              <text key={line} className="sk-sub" x={cx} y={box.y + SUB_Y + index * SUB_STEP} textAnchor="middle">
                {line}
              </text>
            ))}
          </g>
        )
      })}
    </svg>
  )
}
