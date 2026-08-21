'use client'
import { createContext, useContext, useEffect, useState } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import Sidebar from './Sidebar'
import NotificationBell from './NotificationBell'
import { getSession, clearSession, hasModuleAccess, MODULE_ROUTES, type User } from '@/lib/auth'
import { supabase } from '@/lib/supabase'
import { registerPush } from '@/lib/push'

// ── Auth context ──────────────────────────────────────────────────────────────
interface AuthCtx { user: User | null; logout: () => void }
const AuthContext = createContext<AuthCtx>({ user: null, logout: () => {} })
export const useAuth = () => useContext(AuthContext)

const PUBLIC_PATHS = ['/login', '/survey']

// Map exact path prefixes to module names
const PATH_MODULE: Record<string, string> = {
  '/mlr':              'MLR Data',
  '/providers/band-mapping': 'Enrollee Provider Mapping',
  '/sla':                    'SLA Generator',
  '/nhia-vetting':           'NHIA Vetting',
  '/health-screening':       'Health Screening',
  '/pharmacy':               'Pharmacy',
  '/checkin':                'Check-in Monitor',
  '/aftercare':              'Aftercare',
  '/escalations':            'Escalations',
  '/admin':                  'Admin',
}

export default function AppShell({ children }: { children: React.ReactNode }) {
  const router   = useRouter()
  const pathname = usePathname()
  const [user,     setUser]     = useState<User | null>(null)
  const [checking, setChecking] = useState(true)

  useEffect(() => {
    async function check() {
      // Public pages — no auth needed
      if (PUBLIC_PATHS.some(p => pathname.startsWith(p))) {
        setChecking(false)
        return
      }

      const session = getSession()
      if (!session) {
        router.replace('/login')
        return
      }

      // Verify session is still valid (handles password change forcing logout)
      const { data } = await supabase
        .from('staff')
        .select('session_version, status')
        .eq('id', session.id)
        .single()

      if (!data || data.status !== 'ACTIVE' || data.session_version !== session.session_version) {
        clearSession()
        router.replace('/login')
        return
      }

      // Check module access for this path
      const moduleName = Object.entries(PATH_MODULE).find(([prefix]) =>
        pathname.startsWith(prefix)
      )?.[1]

      if (moduleName && !hasModuleAccess(session, moduleName)) {
        // Redirect to first accessible route
        const first = MODULE_ROUTES.find(r => hasModuleAccess(session, r.module))
        router.replace(first?.href ?? '/login')
        return
      }

      setUser(session)
      setChecking(false)

      registerPush(`${session.first_name} ${session.last_name}`.trim()).catch(() => {})
    }

    check()
  }, [pathname])  // re-check on every navigation

  function logout() {
    clearSession()
    setUser(null)
    router.replace('/login')
  }

  // Login page — render bare (no sidebar)
  if (PUBLIC_PATHS.some(p => pathname.startsWith(p))) {
    return <>{children}</>
  }

  // Auth checking spinner
  if (checking) {
    return (
      <div className="min-h-screen bg-[#f6f7f8] flex items-center justify-center">
        <div className="flex flex-col items-center gap-3 text-slate-400">
          <span
            className="material-symbols-outlined text-4xl text-[#137fec]"
            style={{ animation: 'spin 1s linear infinite' }}
          >
            progress_activity
          </span>
          <p className="text-sm font-medium">Loading...</p>
        </div>
      </div>
    )
  }

  return (
    <AuthContext.Provider value={{ user, logout }}>
      <div className="flex min-h-screen">
        <Sidebar />
        <main className="flex-1 md:ml-64 flex flex-col min-h-screen">
          <div className="flex justify-end items-center px-4 py-2 border-b border-slate-100 bg-white sticky top-0 z-40">
            <NotificationBell />
          </div>
          {children}
        </main>
      </div>
    </AuthContext.Provider>
  )
}
