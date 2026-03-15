/** Format a number with Swiss thousands separator (') e.g. 15'440 */
export function formatNumberSwiss(value: number): string {
  const rounded = Math.round(value)
  const sign = rounded < 0 ? '-' : ''
  const abs = Math.abs(rounded).toString()
  return `${sign}${abs.replace(/\B(?=(\d{3})+(?!\d))/g, "'")}`
}
