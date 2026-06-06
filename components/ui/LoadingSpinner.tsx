interface LoadingSpinnerProps {
  message?: string
  fullPage?: boolean
}

export function LoadingSpinner({ message = 'Loading...', fullPage = true }: LoadingSpinnerProps) {
  return (
    <div className={`flex items-center justify-center ${fullPage ? 'flex-1' : 'py-16'}`}>
      <div className="flex flex-col items-center gap-3 text-slate-400">
        <span className="material-symbols-outlined animate-spin text-4xl text-[#137fec]">
          progress_activity
        </span>
        <p className="text-sm font-medium">{message}</p>
      </div>
    </div>
  )
}
