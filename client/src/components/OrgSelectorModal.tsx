import type { ViewerOrg } from '../types'

interface OrgSelectorModalProps {
  open: boolean
  options: ViewerOrg[]
  onSelect: (login: string) => void
  onClose?: () => void
  required?: boolean
}

export default function OrgSelectorModal({ open, options, onSelect, onClose, required }: OrgSelectorModalProps) {
  if (!open) return null

  const canClose = !required && typeof onClose === 'function'

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm px-4">
      <div className="w-full max-w-md space-y-6 rounded-2xl border border-zinc-700 bg-zinc-950 p-6 shadow-2xl">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="text-lg font-semibold">Select an organization</h2>
            <p className="text-sm text-zinc-400">We'll use this org for repositories, PRs, and reviewers.</p>
          </div>
          {canClose && (
            <button
              onClick={() => onClose?.()}
              className="rounded-full border border-zinc-700 px-2 py-1 text-sm text-zinc-400 hover:bg-zinc-800"
              aria-label="Close"
            >
              ×
            </button>
          )}
        </div>
        <div className="space-y-3 max-h-80 overflow-y-auto pr-1">
          {options.length === 0 ? (
            <div className="rounded-xl border border-zinc-800 bg-zinc-900/60 px-4 py-6 text-sm text-zinc-400">
              No organizations found for this account.
            </div>
          ) : (
            options.map((option) => (
              <button
                key={option.login}
                onClick={() => onSelect(option.login)}
                className="flex w-full items-center gap-3 rounded-xl border border-zinc-700 px-4 py-3 text-left transition hover:border-brand-500 hover:bg-brand-500/10"
              >
                {option.avatarUrl ? (
                  <img
                    src={option.avatarUrl}
                    alt={`${option.login} logo`}
                    className="h-10 w-10 flex-shrink-0 rounded-full"
                  />
                ) : (
                  <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-zinc-800 text-sm font-semibold text-zinc-300">
                    {option.login.slice(0, 2).toUpperCase()}
                  </div>
                )}
                <div className="min-w-0">
                  <div className="truncate font-medium text-zinc-100">{option.name ?? option.login}</div>
                  <div className="truncate text-xs text-zinc-400">@{option.login}</div>
                </div>
              </button>
            ))
          )}
        </div>
        {canClose ? (
          <div className="text-xs text-zinc-500">You can change organizations later from the header.</div>
        ) : (
          <div className="text-xs text-amber-300/80">Choose an organization to continue.</div>
        )}
      </div>
    </div>
  )
}
