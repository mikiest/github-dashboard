import { motion } from 'framer-motion'
import type { PREnriched } from '../types'
import { fromNow, short, ageClass } from '../lib_time'

type Props = {
  pr: PREnriched
  username: string
  isNew: boolean
  pinned: boolean               // NEW
  onTogglePin: (id: string) => void // NEW
}

function squares(count: number, cls: string) {
  const capped = Math.min(10, Math.max(0, Math.round(count)))
  return (
    <div className="flex gap-0.5">
      {Array.from({ length: capped }).map((_, i) => (
        <span key={i} className={`w-2 h-2 ${cls} rounded-sm`} />
      ))}
    </div>
  )
}

export default function PRCard({ pr, username, isNew, pinned, onTogglePin }: Props) {
  const requested = pr.requestedReviewers?.some(r => r?.toLowerCase() === username.toLowerCase())
  const approved = pr.approvals > 0

  const additions = pr.additions ?? 0
  const deletions = pr.deletions ?? 0
  const total = additions + deletions || 1
  const addBlocks = additions > 0 ? Math.max(1, Math.round((additions / total) * 10)) : 0
  const delBlocks = deletions > 0 ? Math.max(1, Math.round((deletions / total) * 10)) : 0;
  const branchLabel = `${pr.baseRefName} ← ${pr.headRefName}`;

  return (
    <motion.a
      href={pr.url}
      target="_blank"
      rel="noreferrer"
      className="card group block w-full overflow-hidden p-4 hover:bg-zinc-900/90 transition-colors"
      // animation is controlled by parent via isNew; initial false keeps first render calm
      initial={false}
      animate={isNew ? { boxShadow: ['0 0 0 0 rgba(99,102,241,0.6)', '0 0 0 12px rgba(99,102,241,0)'] } : {}}
      transition={isNew ? { duration: 1.2 } : {}}
    >
      <div className="flex items-start gap-3">
        <div className="flex-1 min-w-0">
          {/* top row: repo + branches (plain text) + badges */}
          <div className="flex flex-wrap items-center gap-2 min-w-0">
            
            <span className="text-zinc-400 text-xs truncate">{pr.repo}</span>
            <span
              className="text-xs font-mono text-zinc-400 inline-block max-w-[300px] truncate align-bottom"
              title={branchLabel}
            >
              {branchLabel}
            </span>
            {pr.isDraft && <span className="badge badge-slate">Draft</span>}
            {approved && <span className="text-xs badge badge-green">Approved × {pr.approvals}</span>}
            {requested && <span className="badge badge-amber">👀 Requested</span>}
            {pr.state === 'merged' && <span className="badge badge-blue">Merged</span>}
          </div>

          <div className="mt-1 font-semibold truncate">{pr.title}</div>

          {/* meta: author + opened + updated/merged (hover shows exact time) */}
          <div className="mt-1 text-xs text-zinc-400">
            #{pr.number} by {pr.author} • opened {fromNow(pr.createdAt)} •{' '}
            {pr.state === 'merged' ? (
              <>merged <span className={ageClass(pr.mergedAt)} title={short(pr.mergedAt)}>{fromNow(pr.mergedAt)}</span></>
            ) : (
              <>updated <span className={ageClass(pr.updatedAt)} title={short(pr.updatedAt)}>{fromNow(pr.updatedAt)}</span></>
            )}
          </div>
        </div>

        {/* right stats, fixed width to avoid overflow */}
        <div className="flex-none w-40 text-right" style={{ position: 'absolute', top: '15px', right: '15px' }}>
          <div className="flex items-center justify-end gap-1">
            {squares(addBlocks, 'bg-green-500/70')}
            {squares(delBlocks, 'bg-red-500/70')}
          </div>
          <div className="text-[11px] text-zinc-400">
            +{pr.additions ?? 0} / -{pr.deletions ?? 0} • {pr.changedFiles ?? 0} files
          </div>
        </div>
        <button
        onClick={(e) => { e.preventDefault(); e.stopPropagation(); onTogglePin(pr.id) }}
        aria-pressed={pinned}
        aria-label={pinned ? 'Unpin PR' : 'Pin PR'}
        title={pinned ? 'Unpin' : 'Pin'}
        className={`absolute bottom-3 right-3 z-10 rounded-full border px-2 py-0.5 text-[11px] transition-opacity
          ${pinned
            ? 'border-amber-400 bg-amber-500/20 text-amber-200 opacity-100'
            : 'border-zinc-700 bg-zinc-900/70 text-zinc-300 opacity-0 group-hover:opacity-100 focus:opacity-100'
          }`}
      >
        📌
      </button>
      </div>
    </motion.a>
  )
}
