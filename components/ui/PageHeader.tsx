import type { ReactNode } from 'react'

interface PageHeaderProps {
  title: string
  right?: ReactNode
}

export function PageHeader({ title, right }: PageHeaderProps) {
  return (
    <header className="h-16 border-b border-slate-200 bg-white flex items-center justify-between pl-14 pr-4 md:px-8 sticky top-0 z-10">
      <h2 className="text-xl font-bold tracking-tight">{title}</h2>
      {right && (
        <div className="hidden sm:flex items-center gap-3 text-xs text-slate-500">
          {right}
        </div>
      )}
    </header>
  )
}
