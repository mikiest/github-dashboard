import type { JSX } from 'react'

export type ReviewBarProps = {
  approvals: number
  changesRequested: number
  commented: number
}

export const ReviewBar = ({ approvals, changesRequested, commented }: ReviewBarProps): JSX.Element => {
  const total = approvals + changesRequested + commented

  const segments = [
    { key: 'approvals', label: 'Approvals', value: approvals, color: 'bg-emerald-500' },
    { key: 'changes', label: 'Changes requested', value: changesRequested, color: 'bg-rose-500' },
    { key: 'comments', label: 'Comments', value: commented, color: 'bg-zinc-500' },
  ]

  if (!total) {
    return (
      <div className="h-5 w-full bg-zinc-800">
        <span className="sr-only">No reviews yet</span>
      </div>
    )
  }

  return (
    <div className="flex h-5 w-full items-stretch bg-zinc-800">
      {segments.map(segment => {
        const percent = Math.round((segment.value / total) * 100)
        const segmentClasses = [
          segment.color,
          'h-full w-full transition-[filter] duration-150 ease-out',
          'group-hover:brightness-110 group-focus-visible:brightness-110',
        ].join(' ')

        const tooltipClasses = [
          'pointer-events-none absolute bottom-full left-1/2 mb-2 -translate-x-1/2 translate-y-1',
          'whitespace-nowrap rounded bg-zinc-900 px-2 py-1 text-xs text-zinc-100 opacity-0 shadow-lg transition',
          'group-hover:translate-y-0 group-hover:opacity-100 group-focus-visible:translate-y-0 group-focus-visible:opacity-100',
        ].join(' ')

        return (
          <div
            key={segment.key}
            className="relative group flex-1 outline-none"
            style={{ flexGrow: Math.max(segment.value, 0.0001), flexBasis: 0 }}
            tabIndex={0}
            aria-label={`${segment.label}: ${segment.value} (${percent}%)`}
          >
            <div className={segmentClasses} />
            <span className={tooltipClasses}>
              {segment.label}: {segment.value} ({percent}%)
            </span>
          </div>
        )
      })}
    </div>
  )
}
