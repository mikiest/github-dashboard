import dayjs from 'dayjs'
import relativeTime from 'dayjs/plugin/relativeTime'
dayjs.extend(relativeTime)

export function fromNow(iso?: string | null) {
  if (!iso) return 'n/a'
  return dayjs(iso).fromNow()
}
export function short(iso?: string | null) {
  if (!iso) return 'n/a'
  return dayjs(iso).format('YYYY-MM-DD HH:mm')
}
/** very recent: ≤4h (red), recent: ≤24h (yellow), else gray */
export function ageClass(iso?: string | null) {
  if (!iso) return 'text-zinc-400'
  const mins = Math.max(0, dayjs().diff(dayjs(iso), 'minute'))
  if (mins <= 240) return 'text-red-300'
  if (mins <= 1440) return 'text-yellow-300'
  return 'text-zinc-400'
}
