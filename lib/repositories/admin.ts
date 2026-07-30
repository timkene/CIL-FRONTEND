import { supabase } from '@/lib/supabase'
import { TABLES } from '@/lib/constants'
import type { Staff, DeptPermission } from '@/lib/types'

export async function fetchStaff(): Promise<Staff[]> {
  const { data, error } = await supabase
    .from(TABLES.STAFF)
    .select('id, first_name, last_name, email, department, status, session_version, created_at, updated_at')
    .order('first_name')

  if (error) throw new Error(error.message)
  return data ?? []
}

export async function fetchDeptPermissions(): Promise<DeptPermission[]> {
  const { data, error } = await supabase
    .from(TABLES.DEPT_PERMISSIONS)
    .select('*')
    .order('department')

  if (error) throw new Error(error.message)
  return data ?? []
}

export async function upsertDeptPermission(dept: string, modules: string[]): Promise<void> {
  const { error } = await supabase
    .from(TABLES.DEPT_PERMISSIONS)
    .upsert({ department: dept, modules }, { onConflict: 'department' })

  if (error) throw new Error(error.message)
}

export async function updateStaffStatus(id: number, status: 'ACTIVE' | 'INACTIVE'): Promise<void> {
  const { error } = await supabase
    .from(TABLES.STAFF)
    .update({ status, updated_at: new Date().toISOString() })
    .eq('id', id)

  if (error) throw new Error(error.message)
}

export async function updateStaffSessionVersion(id: number): Promise<void> {
  const { data, error: fetchError } = await supabase
    .from(TABLES.STAFF)
    .select('session_version')
    .eq('id', id)
    .single()

  if (fetchError) throw new Error(fetchError.message)

  const { error } = await supabase
    .from(TABLES.STAFF)
    .update({ session_version: (data.session_version ?? 0) + 1, updated_at: new Date().toISOString() })
    .eq('id', id)

  if (error) throw new Error(error.message)
}
