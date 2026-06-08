'use client'

import { useState } from 'react'
import type { DateRange } from '@/lib/api/fraudApi'
import { DateRangeFilter } from './components/DateRangeFilter'
import { OverviewTab }    from './components/OverviewTab'
import { ProvidersTab }   from './components/ProvidersTab'
import { MembersTab }     from './components/MembersTab'
import { ClaimsTab }      from './components/ClaimsTab'

type TabKey = 'overview' | 'providers' | 'members' | 'claims'

const TABS: { key: TabKey; label: string; description: string }[] = [
  { key: 'overview',  label: 'Overview',  description: 'Portfolio-level KPIs and billing signals' },
  { key: 'providers', label: 'Providers', description: '5 provider-level fraud lenses' },
  { key: 'members',   label: 'Members',   description: '6 member-level fraud lenses' },
  { key: 'claims',    label: 'Claims',    description: 'Duplicate billing with recovery amounts' },
]

export default function FraudPage() {
  const [activeTab,  setActiveTab]  = useState<TabKey>('overview')
  const [dateRange,  setDateRange]  = useState<DateRange>({ start: '', end: '' })

  return (
    <div className="max-w-7xl mx-auto px-4 py-8 space-y-6">

      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Fraud Intelligence</h1>
          <p className="text-sm text-slate-500 mt-0.5">
            Live analysis across 13 detection dimensions — providers, members, and claims
          </p>
        </div>
        <DateRangeFilter value={dateRange} onChange={setDateRange} />
      </div>

      {/* Tab bar */}
      <div className="border-b border-slate-200">
        <div className="flex gap-1">
          {TABS.map(tab => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              title={tab.description}
              className={`px-5 py-3 text-sm font-semibold border-b-2 transition-colors whitespace-nowrap ${
                activeTab === tab.key
                  ? 'border-[#137fec] text-[#137fec]'
                  : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Tab content — each tab mounts lazily on first click */}
      {activeTab === 'overview'  && <OverviewTab  dateRange={dateRange} />}
      {activeTab === 'providers' && <ProvidersTab dateRange={dateRange} />}
      {activeTab === 'members'   && <MembersTab   dateRange={dateRange} />}
      {activeTab === 'claims'    && <ClaimsTab    dateRange={dateRange} />}

    </div>
  )
}
