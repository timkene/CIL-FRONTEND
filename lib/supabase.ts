import { createClient } from '@supabase/supabase-js'

const url  = process.env.NEXT_PUBLIC_SUPABASE_URL!
const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

export const supabase = createClient(url, anon)

// Re-export all types so existing imports from '@/lib/supabase' keep working
export type { Staff, DeptPermission, MLRSummary } from '@/lib/types'
