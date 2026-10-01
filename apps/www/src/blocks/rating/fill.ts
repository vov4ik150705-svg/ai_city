export function formatNumber(value: number): string {
  return value.toLocaleString("en-US")
}

export function fill(template: string, values: Readonly<Record<string, string | number>>): string {
  return template.replace(/\{(\w+)\}/g, (match, key: string) => {
    const value = values[key]
    if (value === undefined) return match
    return typeof value === "number" ? formatNumber(value) : value
  })
}
