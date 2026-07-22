'use client'
import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import { StatusChip } from '@/components/pharmacy/StatusChip'
import { getPharmacyOrders, deletePharmacyOrder, PharmacyApiError } from '@/lib/pharmacy-api'
import type { PharmacyOrder, OrderStatus } from '@/lib/pharmacy-types'

const PAGE_SIZE = 20

const STATUS_MAP: Record<OrderStatus, { status: 'active' | 'pending' | 'error' | 'info'; label: string }> = {
  bidding:               { status: 'info',    label: 'Bidding' },
  awaiting_fulfillment:  { status: 'pending', label: 'Awaiting Acceptance' },
  accepted:              { status: 'info',    label: 'Accepted' },
  awaiting_confirmation: { status: 'pending', label: 'Confirming Receipt' },
  completed:             { status: 'active',  label: 'Completed' },
  not_received:          { status: 'error',   label: 'Not Received' },
}

const TABLE_HEADERS = ['Intake ID', 'Enrollee', 'Medications', 'Status', 'Time', 'Action']

function StatCard({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="bg-white border border-slate-200 rounded-lg p-5">
      <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">{label}</p>
      <p className="text-3xl font-semibold text-slate-900">{value}</p>
    </div>
  )
}

function SkeletonRow() {
  return (
    <tr>
      {TABLE_HEADERS.map(h => (
        <td key={h} className="px-4 py-3">
          <div className="h-4 bg-slate-100 rounded animate-pulse" />
        </td>
      ))}
    </tr>
  )
}

export default function PharmacyPage() {
  const [orders, setOrders] = useState<PharmacyOrder[]>([])
  const [loading, setLoading] = useState(true)
  const [toast, setToast] = useState<string | null>(null)
  const [page, setPage] = useState(0)
  const [deleting, setDeleting] = useState<string | null>(null)

  const load = useCallback(async () => {
    try {
      const { orders: data } = await getPharmacyOrders()
      setOrders(data)
    } catch (err) {
      setToast(err instanceof PharmacyApiError ? err.message : 'Failed to load orders')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  useEffect(() => {
    const id = setInterval(load, 20_000)
    return () => clearInterval(id)
  }, [load])

  const handleDelete = async (id: string, intakeId: string) => {
    if (!window.confirm(`Delete order ${intakeId}? This cannot be undone.`)) return
    setDeleting(id)
    try {
      await deletePharmacyOrder(id)
      setOrders(prev => prev.filter(o => o.id !== id))
    } catch (err) {
      setToast(err instanceof PharmacyApiError ? err.message : 'Failed to delete order')
    } finally {
      setDeleting(null)
    }
  }

  const today = new Date().toDateString()
  const activeBidding = orders.filter(o => o.status === 'bidding').length
  const awaitingFulfillment = orders.filter(o => o.status === 'awaiting_fulfillment').length
  const completedToday = orders.filter(o => {
    if (o.status !== 'completed' && o.status !== 'not_received') return false
    const stamp = o.completedAt ?? o.createdAt
    return new Date(stamp.endsWith('Z') ? stamp : stamp + 'Z').toDateString() === today
  }).length

  const totalPages = Math.ceil(orders.length / PAGE_SIZE)
  const paged = orders.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE)

  return (
    <div className="p-8">
      {toast && (
        <div className="mb-4 bg-rose-50 border border-rose-200 text-rose-700 px-4 py-3 rounded-lg text-sm flex items-center justify-between">
          <span>{toast}</span>
          <button onClick={() => setToast(null)} className="text-rose-400 hover:text-rose-600 ml-4">✕</button>
        </div>
      )}

      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">Pharmacy Dispatch</h1>
          <p className="text-sm text-slate-500 mt-0.5">Prescription intake and bidding</p>
        </div>
        <Link
          href="/pharmacy/intake/new"
          className="flex items-center gap-2 bg-[#137fec] hover:bg-[#137fec]/90 text-white px-4 py-2 rounded-lg font-semibold text-sm transition-colors"
        >
          <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>add</span>
          New Intake
        </Link>
      </div>

      <div className="grid grid-cols-3 gap-4 mb-8">
        <StatCard label="Active Bidding"       value={loading ? '—' : activeBidding} />
        <StatCard label="Awaiting Fulfillment" value={loading ? '—' : awaitingFulfillment} />
        <StatCard label="Completed Today"      value={loading ? '—' : completedToday} />
      </div>

      <div className="bg-white border border-slate-200 rounded-lg overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-slate-900">Recent Orders</h2>
          <span className="text-xs text-slate-400">Auto-refreshes every 20 s</span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-slate-200">
                {TABLE_HEADERS.map(h => (
                  <th key={h} className="px-4 py-3 text-left text-xs font-bold text-slate-500 uppercase tracking-wider">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading
                ? Array.from({ length: 3 }).map((_, i) => <SkeletonRow key={i} />)
                : paged.map((order, idx) => {
                    const chip = STATUS_MAP[order.status] ?? { status: 'info' as const, label: order.status }
                    const meds = order.medications ?? []
                    return (
                      <tr key={order.id} className={idx % 2 === 0 ? 'bg-white' : 'bg-slate-50'}>
                        <td className="px-4 py-3 font-mono text-sm font-semibold text-slate-700">{order.intakeId}</td>
                        <td className="px-4 py-3 text-sm text-slate-900">{order.enrollee.fullName}</td>
                        <td className="px-4 py-3 text-sm text-slate-500">{meds.length} item{meds.length !== 1 ? 's' : ''}</td>
                        <td className="px-4 py-3"><StatusChip status={chip.status} label={chip.label} /></td>
                        <td className="px-4 py-3 text-sm text-slate-400">
                          {new Date(order.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-3">
                            <Link
                              href={`/pharmacy/orders/${order.id}`}
                              className="text-sm text-[#137fec] hover:underline font-semibold"
                            >
                              View
                            </Link>
                            <button
                              onClick={() => handleDelete(order.id, order.intakeId)}
                              disabled={deleting === order.id}
                              className="text-sm text-rose-500 hover:underline font-semibold disabled:opacity-40"
                            >
                              {deleting === order.id ? 'Deleting…' : 'Delete'}
                            </button>
                          </div>
                        </td>
                      </tr>
                    )
                  })
              }
              {!loading && orders.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-sm text-slate-400">
                    No orders yet.{' '}
                    <Link href="/pharmacy/intake/new" className="text-[#137fec] hover:underline">
                      Create the first intake.
                    </Link>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {totalPages > 1 && (
          <div className="flex items-center justify-between px-6 py-3 border-t border-slate-200">
            <p className="text-sm text-slate-500">Page {page + 1} of {totalPages}</p>
            <div className="flex gap-2">
              <button
                onClick={() => setPage(p => Math.max(0, p - 1))}
                disabled={page === 0}
                className="px-3 py-1 rounded-lg border border-slate-200 text-sm disabled:opacity-40 hover:bg-slate-50 transition-colors"
              >Previous</button>
              <button
                onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))}
                disabled={page === totalPages - 1}
                className="px-3 py-1 rounded-lg border border-slate-200 text-sm disabled:opacity-40 hover:bg-slate-50 transition-colors"
              >Next</button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
