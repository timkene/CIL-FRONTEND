export interface Enrollee {
  enrolleeId: string
  fullName: string
  phone?: string
  address?: string
  title?: string
  gender?: string
  dateOfBirth?: string
  planType?: string
  groupName?: string
  email?: string
  effectiveDate?: string
  terminationDate?: string
  isterminated?: boolean
}

export interface Provider {
  providerId: string
  providerName: string
}

export type MedicationFrequency =
  | 'every 24 hrs'
  | 'every 12 hrs'
  | 'every 8 hrs'
  | 'every 6 hrs'
  | 'every week'
  | 'every month'

export interface Medication {
  procedureCode?: string
  name: string
  dosage: string
  quantity: number
  tablets: number
  frequency: MedicationFrequency | ''
  durationDays: number
  diagnosisCode?: string
  diagnosis: string
}

export interface Bid {
  id: string
  aggregatorId: string
  aggregatorName: string
  unitPrice: number
  totalPrice: number
  isCheapest: boolean
  submittedAt: string
}

export type OrderStatus =
  | 'pending_review'
  | 'rejected'
  | 'bidding'
  | 'awaiting_fulfillment'
  | 'accepted'
  | 'awaiting_confirmation'
  | 'completed'
  | 'not_received'

export interface PharmacyOrder {
  id: string
  intakeId: string
  enrollee: Enrollee
  provider?: Provider
  diagnosis?: string
  medications: Medication[]
  status: OrderStatus
  bids: Bid[]
  winnerId?: string
  winnerName?: string
  winnerTotalPrice?: number
  fulfillmentType?: 'delivered' | 'picked_up'
  deliveryFee?: number
  biddingEndsAt?: string
  createdAt: string
  completedAt?: string
  bidCount?: number
}

export interface SearchResult {
  code: string
  label: string
}

export interface AftercareOutreachRecord {
  enrollee_id: string
  pa_key: string
  phone: string
  providername: string
  visit_date: string
  status: string
  contacted_at: string
}

export interface Escalation {
  id: string
  enrollee_name: string
  enrollee_id: string
  hospital: string
  type: string
  pa_status: string
  level: number
  status: 'open' | 'claimed' | 'resolved'
  claimed_by?: string
  resolved_by?: string
  created_at: string
  claimed_at?: string
  resolved_at?: string
  time_to_claim_min?: number
  time_to_resolve_min?: number
  complaint?: string
  phone?: string
}

export interface EscalationStats {
  open: number
  claimed: number
  resolved_today: number
  total: number
}

export interface MonitorStatus {
  enabled: boolean
  updated_by?: string
  updated_at?: string
}

export interface SyncStatus {
  checkin_presence_count: number
  latest_checkin: string | null
  last_sync: {
    written?: number
    ok?: boolean
    triggered_by?: string
    at?: string
    error?: string
  }
  schedule: string
}

export interface AftercareRecord {
  pa_key: string
  enrollee_id: string
  feedback_text: string
  sentiment: string
  created_at: string
}

export interface AftercareStats {
  total: number
  positive: number
  negative: number
  neutral: number
}
