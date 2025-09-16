import { motion } from 'framer-motion'
import type { PREnriched } from '../types'
import { fromNow, short } from '../lib_time'

type Props = {
  pr: PREnriched
  username: string
  isNew: boolean
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

export default function PRCard({ pr, username, isNew }: Props) {
  const requested = pr.requestedReviewers?.some(r => r?.toLowerCase() === username.toLowerCase())
  const approved = pr.approvals > 0

  const additions = pr.additions ?? 0
  const deletions = pr.deletions ?? 0
  const addBlocks = additions > 0 ? Math.max(1, Math.round(additions / Math.max(5, (additions + deletions) / 10))) : 0
  const delBlocks = deletions > 0 ? Math.max(1, Math.round(deletions / Math.max(5, (additions + deletions) / 10))) : 0

  return (
    <motion.a
      href={pr.url}
      target="_blank"
      rel="noreferrer"
      className="card block p-4 hover:bg-zinc-900/90 transition-colors"
      initial={isNew ? { scale: 0.97, boxShadow: '0 0 0 0 rgba(99,102,241,0.6)' } : false}
      animate={isNew ? { scale: 1, boxShadow: ['0 0 0 0 rgba(99,102,241,0.6)', '0 0 0 12px rgba(99,102,241,0)'] } : {}}
      transition={isNew ? { duration: 1.2 } : {}}
    >
      <div className="flex items-start gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-zinc-400 text-xs">{pr.repo}</span>
            {pr.isDraft && <span className="badge badge-slate">Draft</span>}
            {approved && <span className="badge badge-green">Approved × {pr.approvals}</span>}
            {requested && <span className="badge badge-amber">👀 Requested</span>}
          </div>
          <div className="mt-1 font-semibold truncate">{pr.title}</div>
          <div className="mt-1 text-xs text-zinc-400">
            #{pr.number} by {pr.author} • opened {fromNow(pr.createdAt)} • updated {fromNow(pr.updatedAt)} (at {short(pr.updatedAt)})
            {' '} • {pr.baseRefName} ← {pr.headRefName}
          </div>
        </div>
        <div className="flex flex-col items-end gap-1">
          <div className="flex items-center gap-1">
            {squares(addBlocks, 'bg-green-500/70')}
            {squares(delBlocks, 'bg-red-500/70')}
          </div>
          <div className="text-[11px] text-zinc-400">
            +{pr.additions ?? 0} / -{pr.deletions ?? 0} • {pr.changedFiles ?? 0} files
          </div>
        </div>
      </div>
    </motion.a>
  )
}
