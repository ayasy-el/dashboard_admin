export type DailySeriesPoint = {
  date: string
  value: number
}

export type MonthlySeriesPoint = {
  month: string
  value: number
}

type SeriesOptions = {
  scale?: number
}

const DEFAULT_LOCALE = "id-ID"

const padMonth = (value: number) => String(value).padStart(2, "0")

const hashString = (value: string) => {
  let hash = 0
  for (let i = 0; i < value.length; i += 1) {
    hash = (hash * 31 + value.charCodeAt(i)) % 10000
  }
  return hash
}

export const formatMonthValue = (date: Date) =>
  `${date.getFullYear()}-${padMonth(date.getMonth() + 1)}`

export const getMonthLabel = (month: string, locale = DEFAULT_LOCALE) => {
  const [year, monthIndex] = month.split("-").map(Number)
  const date = new Date(year, monthIndex - 1, 1)
  return date.toLocaleDateString(locale, { month: "long", year: "numeric" })
}

export const getPreviousMonth = (month: string) => {
  const [year, monthIndex] = month.split("-").map(Number)
  const date = new Date(year, monthIndex - 1, 1)
  date.setMonth(date.getMonth() - 1)
  return formatMonthValue(date)
}

export const shiftMonth = (month: string, offset: number) => {
  const [year, monthIndex] = month.split("-").map(Number)
  const date = new Date(year, monthIndex - 1, 1)
  date.setMonth(date.getMonth() + offset)
  return formatMonthValue(date)
}

export const getMonthDays = (month: string) => {
  const [year, monthIndex] = month.split("-").map(Number)
  return new Date(year, monthIndex, 0).getDate()
}

export const formatNumber = (value: number, locale = DEFAULT_LOCALE) =>
  new Intl.NumberFormat(locale).format(value)

export const formatPercent = (value: number, locale = DEFAULT_LOCALE) =>
  new Intl.NumberFormat(locale, {
    maximumFractionDigits: 1,
    minimumFractionDigits: 1,
  }).format(value)

export const buildDailySeries = (
  month: string,
  seedKey: string,
  options: SeriesOptions = {}
) => {
  const scale = options.scale ?? 1
  const days = getMonthDays(month)
  const seed = hashString(`${month}-${seedKey}`)
  const base = 30 + (seed % 50)
  const variance = 10 + (seed % 18)

  const series: DailySeriesPoint[] = []

  for (let day = 1; day <= days; day += 1) {
    const wave = Math.sin((day + seed) / 3) * variance
    const weekly = Math.cos((day + seed) / 2) * (variance / 2)
    const value = Math.max(6, Math.round((base + wave + weekly) * scale))
    series.push({
      date: `${month}-${String(day).padStart(2, "0")}`,
      value,
    })
  }

  return series
}

export const sumSeries = (series: DailySeriesPoint[]) =>
  series.reduce((total, point) => total + point.value, 0)

export const buildMonthlySeries = (
  month: string,
  seedKey: string,
  count = 6,
  options: SeriesOptions = {}
) => {
  const series: MonthlySeriesPoint[] = []

  for (let i = count - 1; i >= 0; i -= 1) {
    const targetMonth = shiftMonth(month, -i)
    const dailySeries = buildDailySeries(targetMonth, seedKey, options)
    series.push({
      month: targetMonth,
      value: sumSeries(dailySeries),
    })
  }

  return series
}
