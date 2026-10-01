export function SectionHead({
  id,
  eyebrow,
  title,
  lead,
}: {
  id: string
  eyebrow: string
  title: string
  lead?: string
}) {
  return (
    <header className="rsec__head">
      <p className="site-eyebrow type-eyebrow">{eyebrow}</p>
      <h2 id={id} className="type-heading-3">
        {title}
      </h2>
      {lead === undefined ? null : <p className="rsec__lead type-body">{lead}</p>}
    </header>
  )
}
