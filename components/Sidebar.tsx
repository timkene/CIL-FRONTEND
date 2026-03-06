'use client'
import Link from 'next/link'
import { usePathname } from 'next/navigation'

const nav = [
  { href: '/mlr',     label: 'MLR Data' },
  { href: '/claims',  label: 'Premium Analysis' },
  { href: '/clients', label: 'Client Analysis' },
]

export default function Sidebar() {
  const path = usePathname()

  return (
    <aside className="w-64 border-r border-slate-200 bg-white flex flex-col fixed h-full z-20">
      {/* Logo */}
      <div className="p-6 flex items-center gap-3">
        <div>
          <h1 className="text-lg font-bold leading-none">Clearline</h1>
          <p className="text-xs text-slate-500">Analytics Portal</p>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-4 space-y-1 overflow-y-auto">
        {nav.map(({ href, label }) => {
          const active = path.startsWith(href)
          return (
            <Link
              key={href}
              href={href}
              className={`flex items-center px-3 py-2.5 rounded-lg text-sm transition-colors ${
                active
                  ? 'bg-[#137fec]/10 text-[#137fec] font-bold'
                  : 'text-slate-600 hover:bg-[#137fec]/10 hover:text-[#137fec] font-medium'
              }`}
            >
              {label}
            </Link>
          )
        })}
      </nav>

      {/* User */}
      <div className="p-4 border-t border-slate-200">
        <div className="flex items-center gap-3 p-2 rounded-lg bg-slate-100">
          <div className="w-8 h-8 rounded-full bg-[#137fec]/20 flex items-center justify-center text-[#137fec] font-bold text-xs">
            CL
          </div>
          <div className="overflow-hidden">
            <p className="text-xs font-bold truncate">Clearline HMO</p>
            <p className="text-[10px] text-slate-500 truncate">Analytics Dashboard</p>
          </div>
        </div>
      </div>
    </aside>
  )
}
