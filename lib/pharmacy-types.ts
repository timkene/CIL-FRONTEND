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
  auto_outreach?: boolean
  registered_phones?: string[]
}

export interface EscalationStats {
  open: number
  claimed: number
  resolved_today: number
  total: number
}

export interface AftercareTrackerRecord {
  enrollee_id: string
  phone: string
  providername?: string
  provider_name?: string
  contacted_at: string
  pa_key?: string
  interaction: 'completed' | 'escalated' | 'pending'
  feedback?: {
    csat?: number
    provider_rating?: number
    clearline_rating?: number
    nps?: number
    escalated?: boolean
    created_at?: string
    comments?: string | null
    source?: string
  } | null
  escalation?: {
    id: string
    complaint?: string
    type?: string
    level?: number
    status?: string
    created_at?: string
  } | null
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
  enrollee_id: string
  provider_name: string
  csat: number | null
  provider_rating: number | null
  clearline_rating: number | null
  nps: number | null
  escalated: boolean
  created_at: string
  comments?: string | null
  source?: string
}

export interface AftercareStats {
  count: number
  form_count?: number
  feeling_worse_count?: number
  false_visit_count?: number
  avg_csat: number | null
  avg_provider_rating: number | null
  avg_clearline_rating: number | null
  avg_nps: number | null
  escalation_count: number
  csat_count?: number
  provider_rating_count?: number
  clearline_rating_count?: number
  nps_count?: number
}
