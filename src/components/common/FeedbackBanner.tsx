interface FeedbackBannerProps {
  message: string
  tone?: 'error' | 'info' | 'success'
  onDismiss?: () => void
}

export function FeedbackBanner({
  message,
  tone = 'info',
  onDismiss,
}: FeedbackBannerProps) {
  const styles =
    tone === 'error'
      ? 'border-mz-error/40 bg-mz-error/10 text-mz-error'
      : tone === 'success'
        ? 'border-green-500/40 bg-green-500/10 text-green-300'
        : 'border-mz-warning/40 bg-mz-warning/10 text-mz-warning'

  return (
    <div
      className={`mb-6 flex items-start justify-between gap-4 rounded-lg border px-4 py-3 text-sm ${styles}`}
      role="status"
    >
      <p>{message}</p>
      {onDismiss && (
        <button
          type="button"
          onClick={onDismiss}
          className="shrink-0 text-xs uppercase tracking-wide opacity-80 hover:opacity-100"
        >
          Dismiss
        </button>
      )}
    </div>
  )
}
