'use client'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useState } from 'react'
import { useAuth } from './AppShell'
import { MODULE_ROUTES, hasModuleAccess } from '@/lib/auth'

export default function Sidebar() {
  const path        = usePathname()
  const { user, logout } = useAuth()
  const [open, setOpen] = useState(false)

  const visibleNav = MODULE_ROUTES.filter(r => hasModuleAccess(user, r.module))

  const initials = user
    ? `${user.first_name[0] ?? ''}${user.last_name[0] ?? ''}`.toUpperCase()
    : 'CL'

  return (
    <>
      {/* Mobile hamburger */}
      <button
        className="fixed top-0 left-0 z-50 md:hidden h-16 w-14 flex items-center justify-center"
        onClick={() => setOpen(o => !o)}
        aria-label="Toggle menu"
      >
        <span className="material-symbols-outlined text-slate-600" style={{ fontSize: '22px' }}>
          {open ? 'close' : 'menu'}
        </span>
      </button>

      {/* Backdrop */}
      {open && (
        <div
          className="fixed inset-0 bg-black/30 z-30 md:hidden"
          onClick={() => setOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside className={`w-64 border-r border-slate-200 bg-white flex flex-col fixed h-full z-40 transition-transform duration-200 ease-in-out
        ${open ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}`}>

        {/* Logo */}
        <div className="p-6">
          <h1 className="text-lg font-bold leading-none">Clearline</h1>
          <p className="text-xs text-slate-500">Analytics Portal</p>
        </div>

        {/* Nav */}
        <nav className="flex-1 px-4 space-y-1 overflow-y-auto">
          {visibleNav.map(({ href, label }) => {
            const active = path.startsWith(href)
            return (
              <Link
                key={href}
                href={href}
                onClick={() => setOpen(false)}
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

        {/* User + logout */}
        <div className="p-4 border-t border-slate-200">
          <div className="flex items-center gap-3 p-2 rounded-lg bg-slate-100">
            <div className="w-8 h-8 rounded-full bg-[#137fec]/20 flex items-center justify-center text-[#137fec] font-bold text-xs shrink-0">
              {initials}
            </div>
            <div className="overflow-hidden flex-1 min-w-0">
              <p className="text-xs font-bold truncate">
                {user ? `${user.first_name} ${user.last_name}` : 'Clearline HMO'}
              </p>
              <p className="text-[10px] text-slate-500 truncate">
                {user?.department ?? 'Analytics Dashboard'}
              </p>
            </div>
            <button
              onClick={logout}
              className="text-slate-400 hover:text-rose-500 transition-colors shrink-0"
              title="Sign out"
            >
              <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>logout</span>
            </button>
          </div>
        </div>
      </aside>
    </>
  )
}
