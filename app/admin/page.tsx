'use client'
import { useEffect, useState, useMemo } from 'react'
import { supabase, type Staff, type DeptPermission } from '@/lib/supabase'
import { ALL_MODULES } from '@/lib/auth'
import { Button } from '@/components/ui'
import { nhiaFetch } from '@/lib/nhia-fetch'

const NHIA_API = process.env.NEXT_PUBLIC_NHIA_API_URL || 'http://localhost:8005'

interface AuditEvent {
  batch_id:          string
  batch_name:        string
  action:            string
  performed_by_id:   number
  performed_by_name: string
  performed_at:      string
  meta:              Record<string, unknown>
}

const AUDIT_ACTION_LABEL: Record<string, string> = {
  CREATE_BATCH:       'Created',
  SAVE_BATCH:         'Saved',
  DELETE_BATCH:       'Deleted',
  SUBMIT_FOR_VETTING: 'Submitted',
  ACCEPT_BATCH:       'Accepted',
  REJECT_BATCH:       'Rejected',
}

const AUDIT_ACTION_STYLE: Record<string, string> = {
  CREATE_BATCH:       'bg-slate-100 text-slate-600',
  SAVE_BATCH:         'bg-slate-100 text-slate-600',
  DELETE_BATCH:       'bg-rose-50 text-rose-700',
  SUBMIT_FOR_VETTING: 'bg-blue-50 text-blue-700',
  ACCEPT_BATCH:       'bg-emerald-50 text-emerald-700',
  REJECT_BATCH:       'bg-rose-50 text-rose-700',
}

function fmtAuditDate(iso: string) {
  try {
    return new Date(iso).toLocaleString('en-NG', {
      day: '2-digit', month: 'short', year: 'numeric',
      hour: '2-digit', minute: '2-digit',
    })
  } catch {
    return iso
  }
}

// ── Helpers ───────────────────────────────────────────────────────────────────
function StatusBadge({ status }: { status: string }) {
  return status === 'ACTIVE'
    ? <span className="px-2 py-0.5 rounded text-xs font-bold bg-emerald-100 text-emerald-700">Active</span>
    : <span className="px-2 py-0.5 rounded text-xs font-bold bg-slate-100 text-slate-500">Inactive</span>
}

function ModuleChip({ mod }: { mod: string }) {
  const colors: Record<string, string> = {
    'MLR Data':        'bg-blue-100 text-blue-700',
    'Premium Analysis':'bg-purple-100 text-purple-700',
    'Client Analysis': 'bg-indigo-100 text-indigo-700',
    'Renewal Plan':    'bg-teal-100 text-teal-700',
    'Admin':           'bg-rose-100 text-rose-700',
    'ALL':             'bg-amber-100 text-amber-700',
  }
  return (
    <span className={`px-2 py-0.5 rounded text-xs font-bold ${colors[mod] ?? 'bg-slate-100 text-slate-600'}`}>
      {mod}
    </span>
  )
}

// ── Add/Edit Staff Modal ──────────────────────────────────────────────────────
function StaffModal({
  staff, departments, onClose, onSave,
}: {
  staff: Partial<Staff> | null
  departments: string[]
  onClose: () => void
  onSave: () => void
}) {
  const isNew = !staff?.id
  const [form, setForm] = useState({
    first_name: staff?.first_name ?? '',
    last_name:  staff?.last_name  ?? '',
    email:      staff?.email      ?? '',
    department: staff?.department ?? (departments[0] ?? ''),
    password:   staff?.password   ?? '',
    status:     (staff?.status    ?? 'ACTIVE') as 'ACTIVE' | 'INACTIVE',
  })
  const [saving, setSaving] = useState(false)
  const [error,  setError]  = useState<string | null>(null)
  const [showPw, setShowPw] = useState(false)

  function set(k: keyof typeof form, v: string) {
    setForm(f => ({ ...f, [k]: v }))
  }

  async function handleSave() {
    if (!form.first_name || !form.email || !form.password || !form.department) {
      setError('First name, email, department and password are required.')
      return
    }
    setSaving(true)
    setError(null)

    if (isNew) {
      const { error: err } = await supabase.from('staff').insert({
        first_name:  form.first_name.trim(),
        last_name:   form.last_name.trim(),
        email:       form.email.trim().toLowerCase(),
        department:  form.department.trim().toUpperCase(),
        password:    form.password,
        status:      form.status,
        session_version: 1,
      })
      if (err) { setError(err.message); setSaving(false); return }
    } else {
      // Password changed → bump session_version to force logout
      const updates: Partial<Staff> & { session_version?: number; updated_at?: string } = {
        first_name: form.first_name.trim(),
        last_name:  form.last_name.trim(),
        department: form.department.trim().toUpperCase(),
        status:     form.status,
        updated_at: new Date().toISOString(),
      }
      if (form.password !== staff?.password) {
        updates.password        = form.password
        updates.session_version = (staff?.session_version ?? 1) + 1
      }
      const { error: err } = await supabase.from('staff').update(updates).eq('id', staff!.id!)
      if (err) { setError(err.message); setSaving(false); return }
    }

    onSave()
  }

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
          <h3 className="font-bold text-base">{isNew ? 'Add New Member' : 'Edit Member'}</h3>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600">
            <span className="material-symbols-outlined" style={{ fontSize: '20px' }}>close</span>
          </button>
        </div>

        <div className="p-6 space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-semibold text-slate-500 uppercase">First Name</label>
              <input className="mt-1 w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-[#137fec]"
                value={form.first_name} onChange={e => set('first_name', e.target.value)} />
            </div>
            <div>
              <label className="text-xs font-semibold text-slate-500 uppercase">Last Name</label>
              <input className="mt-1 w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-[#137fec]"
                value={form.last_name} onChange={e => set('last_name', e.target.value)} />
            </div>
          </div>

          <div>
            <label className="text-xs font-semibold text-slate-500 uppercase">Email</label>
            <input type="email" disabled={!isNew}
              className="mt-1 w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-[#137fec] disabled:opacity-50"
              value={form.email} onChange={e => set('email', e.target.value)} />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-semibold text-slate-500 uppercase">Department</label>
              <select className="mt-1 w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-[#137fec]"
                value={form.department} onChange={e => set('department', e.target.value)}>
                {departments.map(d => <option key={d} value={d}>{d}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs font-semibold text-slate-500 uppercase">Status</label>
              <select className="mt-1 w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-[#137fec]"
                value={form.status} onChange={e => set('status', e.target.value as 'ACTIVE' | 'INACTIVE')}>
                <option value="ACTIVE">Active</option>
                <option value="INACTIVE">Inactive</option>
              </select>
            </div>
          </div>

          <div>
            <label className="text-xs font-semibold text-slate-500 uppercase">
              Password {!isNew && <span className="text-slate-400 normal-case font-normal">(leave unchanged to keep current)</span>}
            </label>
            <div className="relative mt-1">
              <input type={showPw ? 'text' : 'password'}
                className="w-full px-3 py-2 pr-10 bg-slate-50 border border-slate-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-[#137fec]"
                value={form.password} onChange={e => set('password', e.target.value)} />
              <button type="button" className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400"
                onClick={() => setShowPw(v => !v)}>
                <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>
                  {showPw ? 'visibility_off' : 'visibility'}
                </span>
              </button>
            </div>
            {!isNew && form.password !== staff?.password && (
              <p className="text-xs text-amber-600 mt-1 flex items-center gap-1">
                <span className="material-symbols-outlined" style={{ fontSize: '14px' }}>warning</span>
                Password changed — user will be logged out automatically.
              </p>
            )}
          </div>

          {error && (
            <div className="text-sm text-rose-600 bg-rose-50 rounded-lg px-3 py-2">{error}</div>
          )}
        </div>

        <div className="px-6 pb-6 flex gap-3 justify-end">
          <Button variant="ghost" size="sm" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="primary" size="sm" loading={saving} onClick={handleSave}>
            {isNew ? 'Add Member' : 'Save Changes'}
          </Button>
        </div>
      </div>
    </div>
  )
}

// ── Edit Department Permissions Modal ─────────────────────────────────────────
function DeptModal({
  dept, onClose, onSave,
}: {
  dept: DeptPermission
  onClose: () => void
  onSave: () => void
}) {
  const isAll = dept.modules.includes('ALL')
  const [allAccess, setAllAccess] = useState(isAll)
  const [selected,  setSelected]  = useState<Set<string>>(
    new Set(isAll ? ALL_MODULES : dept.modules)
  )
  const [saving, setSaving] = useState(false)

  function toggle(mod: string) {
    setSelected(prev => {
      const next = new Set(prev)
      next.has(mod) ? next.delete(mod) : next.add(mod)
      return next
    })
  }

  async function handleSave() {
    setSaving(true)
    const modules = allAccess ? ['ALL'] : Array.from(selected)
    await supabase
      .from('department_permissions')
      .update({ modules })
      .eq('id', dept.id)
    onSave()
  }

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
          <div>
            <h3 className="font-bold text-base">{dept.department}</h3>
            <p className="text-xs text-slate-400">Edit module access</p>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600">
            <span className="material-symbols-outlined" style={{ fontSize: '20px' }}>close</span>
          </button>
        </div>

        <div className="p-6 space-y-3">
          {/* ALL access toggle */}
          <label className="flex items-center gap-3 p-3 rounded-lg border border-amber-200 bg-amber-50 cursor-pointer">
            <input type="checkbox" checked={allAccess} onChange={e => setAllAccess(e.target.checked)}
              className="w-4 h-4 accent-[#137fec]" />
            <div>
              <p className="text-sm font-bold text-amber-700">All Modules (including Admin)</p>
              <p className="text-xs text-amber-600">Full access to everything</p>
            </div>
          </label>

          {!allAccess && (
            <div className="space-y-2 pt-1">
              {ALL_MODULES.map(mod => (
                <label key={mod} className="flex items-center gap-3 p-2.5 rounded-lg border border-slate-100 hover:bg-slate-50 cursor-pointer">
                  <input type="checkbox" checked={selected.has(mod)} onChange={() => toggle(mod)}
                    className="w-4 h-4 accent-[#137fec]" />
                  <span className="text-sm font-medium text-slate-700">{mod}</span>
                </label>
              ))}
            </div>
          )}
        </div>

        <div className="px-6 pb-6 flex gap-3 justify-end">
          <Button variant="ghost" size="sm" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="primary" size="sm" loading={saving} onClick={handleSave}>
            Save
          </Button>
        </div>
      </div>
    </div>
  )
}

// ── Main Admin Page ───────────────────────────────────────────────────────────
type Tab = 'staff' | 'departments' | 'nhia-activity'

export default function AdminPage() {
  const [tab,     setTab]     = useState<Tab>('staff')
  const [staff,   setStaff]   = useState<Staff[]>([])
  const [depts,   setDepts]   = useState<DeptPermission[]>([])
  const [loading, setLoading] = useState(true)
  const [search,  setSearch]  = useState('')
  const [deptFilter, setDeptFilter] = useState('ALL')

  const [auditEvents,  setAuditEvents]  = useState<AuditEvent[]>([])
  const [auditLoading, setAuditLoading] = useState(false)
  const [auditSearch,  setAuditSearch]  = useState('')
  const [auditError,   setAuditError]   = useState('')

  // Modals
  const [editStaff,    setEditStaff]    = useState<Partial<Staff> | null | false>(false)
  const [editDept,     setEditDept]     = useState<DeptPermission | null>(null)

  async function loadAll() {
    const [s, d] = await Promise.all([
      supabase.from('staff').select('*').order('first_name'),
      supabase.from('department_permissions').select('*').order('department'),
    ])
    setStaff(s.data ?? [])
    setDepts(d.data ?? [])
    setLoading(false)
  }

  async function loadAuditEvents() {
    setAuditLoading(true)
    setAuditError('')
    try {
      const res = await nhiaFetch(`${NHIA_API}/api/v1/nhia/audit-log?limit=500`)
      const data = await res.json()
      setAuditEvents(data.events ?? [])
    } catch {
      setAuditError('Failed to load NHIA activity. Please try again.')
      setAuditEvents([])
    } finally {
      setAuditLoading(false)
    }
  }

  useEffect(() => { loadAll() }, [])

  useEffect(() => {
    if (tab === 'nhia-activity') loadAuditEvents()
  }, [tab])

  const departments = useMemo(() => depts.map(d => d.department).sort(), [depts])

  const filteredStaff = useMemo(() =>
    staff.filter(s => {
      const matchSearch = `${s.first_name} ${s.last_name} ${s.email}`.toLowerCase().includes(search.toLowerCase())
      const matchDept   = deptFilter === 'ALL' || s.department === deptFilter
      return matchSearch && matchDept
    }),
    [staff, search, deptFilter]
  )

  async function toggleStatus(s: Staff) {
    const newStatus = s.status === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE'
    await supabase.from('staff').update({ status: newStatus, updated_at: new Date().toISOString() }).eq('id', s.id)
    setStaff(prev => prev.map(x => x.id === s.id ? { ...x, status: newStatus } : x))
  }

  if (loading) return (
    <div className="flex-1 flex items-center justify-center">
      <span className="material-symbols-outlined text-4xl text-[#137fec]" style={{ animation: 'spin 1s linear infinite' }}>
        progress_activity
      </span>
    </div>
  )

  return (
    <>
      {/* Modals */}
      {editStaff !== false && (
        <StaffModal
          staff={editStaff}
          departments={departments}
          onClose={() => setEditStaff(false)}
          onSave={() => { setEditStaff(false); loadAll() }}
        />
      )}
      {editDept && (
        <DeptModal
          dept={editDept}
          onClose={() => setEditDept(null)}
          onSave={() => { setEditDept(null); loadAll() }}
        />
      )}

      {/* Header */}
      <header className="h-16 border-b border-slate-200 bg-white flex items-center justify-between pl-14 pr-4 md:px-8 sticky top-0 z-10">
        <h2 className="text-xl font-bold tracking-tight">Admin</h2>
        <span className="hidden sm:flex items-center gap-1.5 text-xs text-slate-500">
          <span className="material-symbols-outlined text-sm">shield</span>
          Roles &amp; Permissions
        </span>
      </header>

      <div className="p-4 md:p-8 space-y-6">

        {/* Tabs */}
        <div className="border-b border-slate-200 flex gap-6">
          {([['staff', 'Team Members'], ['departments', 'Department Permissions'], ['nhia-activity', 'NHIA Activity']] as [Tab, string][]).map(([t, label]) => (
            <button key={t} onClick={() => setTab(t)}
              className={`pb-3 border-b-2 text-sm font-bold tracking-wide transition-colors ${
                tab === t ? 'border-[#137fec] text-[#137fec]' : 'border-transparent text-slate-400 hover:text-[#137fec]'
              }`}>
              {label}
            </button>
          ))}
        </div>

        {/* ── Staff tab ─────────────────────────────────────────────────── */}
        {tab === 'staff' && (
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
            {/* Toolbar */}
            <div className="p-4 md:p-6 border-b border-slate-100 flex flex-col sm:flex-row gap-3 sm:items-center sm:justify-between">
              <div>
                <h4 className="text-lg font-bold">Team Members</h4>
                <p className="text-sm text-slate-500">{filteredStaff.length} of {staff.length} members</p>
              </div>
              <div className="flex flex-col sm:flex-row gap-2">
                {/* Dept filter */}
                <select
                  className="px-3 py-2 bg-slate-100 border-none rounded-lg text-sm outline-none focus:ring-2 focus:ring-[#137fec]"
                  value={deptFilter} onChange={e => setDeptFilter(e.target.value)}>
                  <option value="ALL">All departments</option>
                  {departments.map(d => <option key={d} value={d}>{d}</option>)}
                </select>
                {/* Search */}
                <div className="relative">
                  <svg className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
                  <input
                    className="pl-9 pr-4 py-2 bg-slate-100 border-none rounded-lg text-sm w-full sm:w-48 outline-none focus:ring-2 focus:ring-[#137fec]"
                    placeholder="Search..."
                    value={search} onChange={e => setSearch(e.target.value)}
                  />
                </div>
                {/* Add member */}
                <Button
                  variant="primary"
                  size="sm"
                  onClick={() => setEditStaff({})}
                  leftIcon={<span className="material-symbols-outlined">person_add</span>}
                >
                  Add Member
                </Button>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-sm text-left">
                <thead>
                  <tr className="bg-slate-50 text-slate-500 text-xs font-bold uppercase tracking-wider">
                    <th className="px-4 md:px-6 py-3">#</th>
                    <th className="px-4 md:px-6 py-3">Name</th>
                    <th className="px-4 md:px-6 py-3 hidden md:table-cell">Email</th>
                    <th className="px-4 md:px-6 py-3">Department</th>
                    <th className="px-4 md:px-6 py-3 hidden lg:table-cell">Password</th>
                    <th className="px-4 md:px-6 py-3 text-center">Status</th>
                    <th className="px-4 md:px-6 py-3 text-center">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredStaff.map((s, i) => (
                    <StaffRow
                      key={s.id}
                      rank={i + 1}
                      staff={s}
                      onToggle={() => toggleStatus(s)}
                      onEdit={() => setEditStaff(s)}
                    />
                  ))}
                  {filteredStaff.length === 0 && (
                    <tr><td colSpan={7} className="px-6 py-10 text-center text-slate-400">No members found</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ── Departments tab ───────────────────────────────────────────── */}
        {tab === 'departments' && (
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="p-4 md:p-6 border-b border-slate-100">
              <h4 className="text-lg font-bold">Department Permissions</h4>
              <p className="text-sm text-slate-500">{depts.length} departments — click Edit to change module access</p>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm text-left">
                <thead>
                  <tr className="bg-slate-50 text-slate-500 text-xs font-bold uppercase tracking-wider">
                    <th className="px-4 md:px-6 py-3">Department</th>
                    <th className="px-4 md:px-6 py-3">Module Access</th>
                    <th className="px-4 md:px-6 py-3 text-center">Members</th>
                    <th className="px-4 md:px-6 py-3 text-center">Edit</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {depts.map(d => {
                    const memberCount = staff.filter(s => s.department === d.department).length
                    return (
                      <tr key={d.id} className="hover:bg-slate-50 transition-colors">
                        <td className="px-4 md:px-6 py-4 font-bold">{d.department}</td>
                        <td className="px-4 md:px-6 py-4">
                          <div className="flex flex-wrap gap-1.5">
                            {d.modules.includes('ALL')
                              ? <ModuleChip mod="ALL" />
                              : d.modules.map(m => <ModuleChip key={m} mod={m} />)
                            }
                          </div>
                        </td>
                        <td className="px-4 md:px-6 py-4 text-center text-slate-500">{memberCount}</td>
                        <td className="px-4 md:px-6 py-4 text-center">
                          <button
                            onClick={() => setEditDept(d)}
                            className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-bold text-[#137fec] bg-[#137fec]/10 hover:bg-[#137fec]/20 rounded-lg transition-colors"
                          >
                            <span className="material-symbols-outlined" style={{ fontSize: '14px' }}>edit</span>
                            Edit
                          </button>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ── NHIA Activity tab ──────────────────────────────────────────────────── */}
        {tab === 'nhia-activity' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h4 className="text-lg font-bold">NHIA Vetting Activity</h4>
                <p className="text-sm text-slate-500">All staff actions on NHIA claims batches</p>
              </div>
              <button
                onClick={loadAuditEvents}
                className="px-3 py-1.5 text-xs font-semibold text-[#137fec] border border-[#137fec] rounded-lg hover:bg-[#137fec]/5 transition-colors"
              >
                Refresh
              </button>
            </div>

            <div className="max-w-sm">
              <input
                type="text"
                placeholder="Search by batch or staff name…"
                value={auditSearch}
                onChange={e => setAuditSearch(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#137fec]/30"
              />
            </div>

            {auditError && (
              <div className="text-sm text-rose-600 bg-rose-50 border border-rose-200 rounded-lg px-4 py-3">
                {auditError}
              </div>
            )}

            <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
              {auditLoading ? (
                <div className="flex items-center justify-center py-16">
                  <span
                    className="material-symbols-outlined text-4xl text-[#137fec]"
                    style={{ animation: 'spin 1s linear infinite' }}
                  >
                    progress_activity
                  </span>
                </div>
              ) : auditEvents.length === 0 ? (
                <div className="text-center py-16 text-slate-400 text-sm">
                  No activity yet.{' '}
                  <button onClick={loadAuditEvents} className="text-[#137fec] underline">Load</button>
                </div>
              ) : (
                <table className="w-full text-sm">
                  <thead className="bg-slate-50 border-b border-slate-200">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-bold text-slate-500 uppercase tracking-wide">Date / Time</th>
                      <th className="px-4 py-3 text-left text-xs font-bold text-slate-500 uppercase tracking-wide">Action</th>
                      <th className="px-4 py-3 text-left text-xs font-bold text-slate-500 uppercase tracking-wide">Batch</th>
                      <th className="px-4 py-3 text-left text-xs font-bold text-slate-500 uppercase tracking-wide">Performed By</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {auditEvents
                      .filter(e => {
                        const q = auditSearch.toLowerCase()
                        return (
                          e.batch_name.toLowerCase().includes(q) ||
                          e.performed_by_name.toLowerCase().includes(q)
                        )
                      })
                      .map((e, i) => (
                        <tr key={i} className="hover:bg-slate-50 transition-colors">
                          <td className="px-4 py-3 text-slate-500 whitespace-nowrap">{fmtAuditDate(e.performed_at)}</td>
                          <td className="px-4 py-3">
                            <span className={`inline-block px-2 py-0.5 rounded text-xs font-bold ${AUDIT_ACTION_STYLE[e.action] ?? 'bg-slate-100 text-slate-600'}`}>
                              {AUDIT_ACTION_LABEL[e.action] ?? e.action}
                            </span>
                          </td>
                          <td className="px-4 py-3 font-medium text-slate-700">{e.batch_name || e.batch_id}</td>
                          <td className="px-4 py-3 text-slate-700">{e.performed_by_name}</td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        )}
      </div>
    </>
  )
}

// ── Staff row with password reveal ────────────────────────────────────────────
function StaffRow({ rank, staff, onToggle, onEdit }: {
  rank: number
  staff: Staff
  onToggle: () => void
  onEdit: () => void
}) {
  const [showPw, setShowPw] = useState(false)

  return (
    <tr className="hover:bg-slate-50 transition-colors">
      <td className="px-4 md:px-6 py-3 text-slate-400">{rank}</td>
      <td className="px-4 md:px-6 py-3 font-semibold whitespace-nowrap">
        {staff.first_name} {staff.last_name}
      </td>
      <td className="px-4 md:px-6 py-3 text-slate-500 text-xs hidden md:table-cell">{staff.email}</td>
      <td className="px-4 md:px-6 py-3">
        <span className="text-xs font-semibold text-slate-600 bg-slate-100 px-2 py-0.5 rounded">
          {staff.department}
        </span>
      </td>
      <td className="px-4 md:px-6 py-3 hidden lg:table-cell">
        <div className="flex items-center gap-2">
          <span className="text-sm font-mono text-slate-700">
            {showPw ? staff.password : '••••••••'}
          </span>
          <button
            onClick={() => setShowPw(v => !v)}
            className="text-slate-400 hover:text-slate-600"
            title={showPw ? 'Hide password' : 'Show password'}
          >
            <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>
              {showPw ? 'visibility_off' : 'visibility'}
            </span>
          </button>
        </div>
      </td>
      <td className="px-4 md:px-6 py-3 text-center">
        <StatusBadge status={staff.status} />
      </td>
      <td className="px-4 md:px-6 py-3">
        <div className="flex items-center justify-center gap-2">
          {/* Toggle active/inactive */}
          <button
            onClick={onToggle}
            title={staff.status === 'ACTIVE' ? 'Deactivate' : 'Activate'}
            className={`p-1.5 rounded-lg transition-colors ${
              staff.status === 'ACTIVE'
                ? 'text-slate-400 hover:bg-rose-50 hover:text-rose-500'
                : 'text-slate-400 hover:bg-emerald-50 hover:text-emerald-600'
            }`}
          >
            <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>
              {staff.status === 'ACTIVE' ? 'person_off' : 'person_check'}
            </span>
          </button>
          {/* Edit */}
          <button
            onClick={onEdit}
            title="Edit member"
            className="p-1.5 rounded-lg text-slate-400 hover:bg-[#137fec]/10 hover:text-[#137fec] transition-colors"
          >
            <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>edit</span>
          </button>
        </div>
      </td>
    </tr>
  )
}
