export interface CdrMedication {
  drug_code: string
  drug_name: string
  quantity_per_supply: number
  diagnosis_code: string
  procedure_code: string
}

export interface CdrEnrollee {
  enrollee_id: string
  firstname: string
  phone: string
  medications: CdrMedication[]
  status: 'active' | 'suspended' | 'discharged'
  next_due_at: string | null
  last_receipt_confirmed_at: string | null
  created_at: string
  is_due?: boolean
}

export type SupplyStatus = 'pending' | 'confirmed' | 'expired' | 'cancelled' | 'pa_failed'

export interface SupplyMedication {
  drug_code: string
  drug_name: string
  quantity: number
  unit_price: number
  diagnosis_code: string
  procedure_code: string
  pa_number: string | null
  pa_status: 'ok' | 'failed' | null
}

export interface CdrSupply {
  supply_id: string
  enrollee_id: string
  status: SupplyStatus
  medications: SupplyMedication[]
  triggered_at: string
  confirmed_at: string | null
  expires_at: string | null
  inventory_decremented: boolean
  confirmation_channel?: string
}

export interface CdrInventoryItem {
  drug_code: string
  drug_name: string
  quantity_on_hand: number
  low_stock_threshold: number
  unit_price: number
  updated_at?: string
}

export interface CdrVitalsCheckin {
  enrollee_id: string
  week: string
  sent_at: string
  responded_at: string | null
  response: string | null
}

export interface CdrStats {
  active_enrollees: number
  due_today: number
  pending_confirmations: number
  low_stock_count: number
  supply_chart: { date: string; triggered: number; confirmed: number }[]
}

export interface CdrEnrolleeCreate {
  enrollee_id: string
  firstname: string
  phone: string
  medications: CdrMedication[]
  last_supply_date?: string
}
