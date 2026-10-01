import { Link } from "../../site"
import { resolveHref } from "../md/chapter"
import type { Inline } from "../md/types"
import { renderTex } from "./tex"

export function MathTex({ tex, display }: { tex: string; display: boolean }) {
  const html = renderTex(tex, display)
  if (html === null) return <code className="hb-math-error">{tex}</code>
  return display ? (
    <div className="hb-math" dangerouslySetInnerHTML={{ __html: html }} />
  ) : (
    <span className="hb-math-inline" dangerouslySetInnerHTML={{ __html: html }} />
  )
}

export function InlineNodes({ nodes, chapter }: { nodes: readonly Inline[]; chapter: string }) {
  return (
    <>
      {nodes.map((node, index) => {
        switch (node.kind) {
          case "text":
            return node.value
          case "strong":
            return (
              <strong key={index}>
                <InlineNodes nodes={node.children} chapter={chapter} />
              </strong>
            )
          case "code":
            return (
              <code key={index} className="hb-code">
                {node.value}
              </code>
            )
          case "flag":
            return (
              <span key={index} className="hb-flag">
                {node.value}
              </span>
            )
          case "math":
            return <MathTex key={index} tex={node.tex} display={false} />
          case "link": {
            const target = resolveHref(node.href, chapter)
            const children = <InlineNodes nodes={node.children} chapter={chapter} />
            if (target.kind === "internal") {
              return (
                <Link key={index} to={target.href} className="hb-link">
                  {children}
                </Link>
              )
            }
            return (
              <a key={index} href={target.href} className="hb-link" target="_blank" rel="noopener noreferrer">
                {children}
              </a>
            )
          }
          default: {
            const never: never = node
            throw new Error(`unknown inline ${String(never)}`)
          }
        }
      })}
    </>
  )
}
