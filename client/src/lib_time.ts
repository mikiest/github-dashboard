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
