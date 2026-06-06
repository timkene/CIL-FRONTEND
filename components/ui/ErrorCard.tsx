interface ErrorCardProps {
  message:  string
  onRetry?: () => void
  fullPage?: boolean
}

export function ErrorCard({ message, onRetry, fullPage = true }: ErrorCardProps) {
  return (
    <div className={`flex items-center justify-center ${fullPage ? 'flex-1' : 'py-10'}`}>
      <div className="bg-rose-50 border border-rose-200 rounded-xl p-6 text-rose-700 max-w-md text-center">
        <span className="material-symbols-outlined text-3xl mb-2 block">error</span>
        <p className="font-bold">Failed to load data</p>
        <p className="text-sm mt-1 text-rose-600">{message}</p>
        {onRetry && (
          <button
            onClick={onRetry}
            className="mt-4 px-4 py-2 text-sm font-semibold bg-rose-100 rounded-lg hover:bg-rose-200 transition-colors"
          >
            Try Again
          </button>
        )}
      </div>
    </div>
  )
}
