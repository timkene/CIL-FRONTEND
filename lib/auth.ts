export const ALL_MODULES = [
  'MLR Data',
  'Premium Analysis',
  'Client Analysis',
  'Renewal Plan',
  'Provider Fraud',
  'Enrollee Provider Mapping',
  'Executive Dashboard',
  'AI Medical Report',
  'SLA Generator',
  'NHIA Vetting',
  'Admin',
] as const

export type ModuleName = typeof ALL_MODULES[number]

export interface User {
  id:              number
  first_name:      string
  last_name:       string
  email:           string
  department:      string
  modules:         string[]   // ['ALL'] or subset of ALL_MODULES
  session_version: number
}

export const MODULE_ROUTES: { href: string; label: string; module: string }[] = [
  { href: '/mlr',            label: 'MLR Data',        module: 'MLR Data' },
  { href: '/claims',         label: 'Premium Analysis', module: 'Premium Analysis' },
  { href: '/clients',        label: 'Client Analysis',  module: 'Client Analysis' },
  { href: '/renewal',        label: 'Renewal Plan',     module: 'Renewal Plan' },
  { href: '/providers/fraud',         label: 'Fraud',                     module: 'Provider Fraud' },
  { href: '/providers/band-mapping',  label: 'Enrollee Provider Mapping', module: 'Enrollee Provider Mapping' },
  { href: '/dashboard',               label: 'Executive Dashboard',       module: 'Executive Dashboard' },
  { href: '/reports',                 label: 'AI Medical Report',         module: 'AI Medical Report' },
  { href: '/sla',                     label: 'SLA Generator',             module: 'SLA Generator' },
  { href: '/nhia-vetting',            label: 'NHIA Vetting',              module: 'NHIA Vetting' },
  { href: '/admin',                   label: 'Admin',                     module: 'Admin' },
]

const SESSION_KEY = 'clearline_session'

export function getSession(): User | null {
  if (typeof window === 'undefined') return null
  try {
    const raw = localStorage.getItem(SESSION_KEY)
    return raw ? (JSON.parse(raw) as User) : null
  } catch {
    return null
  }
}

export function setSession(user: User): void {
  localStorage.setItem(SESSION_KEY, JSON.stringify(user))
}

export function clearSession(): void {
  localStorage.removeItem(SESSION_KEY)
}

export function hasModuleAccess(user: User | null, moduleName: string): boolean {
  if (!user) return false
  return user.modules.includes('ALL') || user.modules.includes(moduleName)
}

export function isAdmin(user: User | null): boolean {
  return hasModuleAccess(user, 'Admin')
}
