export type Align = "left" | "center" | "right" | null

export type Inline =
  | { readonly kind: "text"; readonly value: string }
  | { readonly kind: "strong"; readonly children: readonly Inline[] }
  | { readonly kind: "code"; readonly value: string }
  | { readonly kind: "flag"; readonly value: string }
  | { readonly kind: "math"; readonly tex: string }
  | { readonly kind: "link"; readonly href: string; readonly children: readonly Inline[] }

export type HeadingDepth = 1 | 2 | 3 | 4

export type Block =
  | {
      readonly kind: "heading"
      readonly depth: HeadingDepth
      readonly id: string
      readonly text: string
      readonly children: readonly Inline[]
    }
  | { readonly kind: "paragraph"; readonly children: readonly Inline[] }
  | {
      readonly kind: "list"
      readonly ordered: boolean
      readonly start: number
      readonly items: readonly (readonly Inline[])[]
    }
  | {
      readonly kind: "table"
      readonly align: readonly Align[]
      readonly head: readonly (readonly Inline[])[]
      readonly rows: readonly (readonly (readonly Inline[])[])[]
    }
  | { readonly kind: "math"; readonly tex: string }
  | { readonly kind: "code"; readonly lang: string; readonly value: string; readonly line: number }
  | { readonly kind: "quote"; readonly children: readonly Block[] }

export type Issue = { readonly line: number; readonly message: string }

export type IssueSink = (line: number, message: string) => void

export const NEEDS_CONFIRMATION = "[NEEDS CONFIRMATION]"
