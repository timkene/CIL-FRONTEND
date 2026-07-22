'use client'
import type { Bid } from '@/lib/pharmacy-types'

interface BiddingTableProps {
  bids: Bid[]
  reconnecting?: boolean
}

export function BiddingTable({ bids, reconnecting = false }: BiddingTableProps) {
  const sorted = [...bids].sort((a, b) => a.totalPrice - b.totalPrice)

  return (
    <div className="bg-white border border-slate-200 rounded-lg overflow-hidden">
      <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200">
        <h2 className="text-xl font-semibold text-slate-900">Live Bids</h2>
        {reconnecting && (
          <span className="flex items-center gap-1.5 text-sm text-amber-700 bg-amber-50 px-2.5 py-0.5 rounded-full border border-amber-200">
            <span className="material-symbols-outlined" style={{ fontSize: '14px' }}>sync</span>
            Reconnecting…
          </span>
        )}
      </div>

      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b border-slate-200">
              {['Aggregator', 'Unit Price', 'Total Quote', 'Status'].map(h => (
                <th key={h} className="px-4 py-3 text-left text-xs font-bold text-slate-500 uppercase tracking-wider">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {sorted.length === 0 ? (
              <tr>
                <td colSpan={4} className="px-4 py-8 text-center text-sm text-slate-400">
                  Waiting for bids…
                </td>
              </tr>
            ) : (
              sorted.map((bid, idx) => (
                <tr
                  key={bid.id}
                  className={`transition-colors ${
                    bid.isCheapest
                      ? 'bg-emerald-50/50'
                      : idx % 2 === 0 ? 'bg-white' : 'bg-slate-50'
                  }`}
                >
                  <td className="px-4 py-3 text-sm font-semibold text-slate-900">{bid.aggregatorName}</td>
                  <td className="px-4 py-3 font-mono text-sm font-semibold text-slate-700">
                    ₦{bid.unitPrice.toLocaleString()}
                  </td>
                  <td className="px-4 py-3 font-mono text-sm font-bold text-slate-900">
                    ₦{bid.totalPrice.toLocaleString()}
                  </td>
                  <td className="px-4 py-3">
                    {bid.isCheapest ? (
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-50 text-emerald-700 uppercase tracking-wider border border-emerald-200">
                        CHEAPEST
                      </span>
                    ) : (
                      <span className="text-sm text-slate-400">Competitive</span>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
