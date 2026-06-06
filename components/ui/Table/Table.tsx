'use client'

import { useState } from 'react'
import { cn } from '@/lib/utils/cn'
import type { TableProps, SortDirection } from './types'

// ────────────────────────────────────────────────────────────────────────────
// Table Component
// ────────────────────────────────────────────────────────────────────────────

function getNestedValue(obj: any, path: string): any {
  return path.split('.').reduce((value, key) => value?.[key], obj)
}

export function Table<T = any>({
  columns,
  data,
  rowKey = (row: any) => row.id,
  loading = false,
  emptyMessage = 'No data available',
  bordered = true,
  striped = false,
  hoverable = true,
  onRowClick,
  sortKey: externalSortKey,
  sortDirection: externalSortDirection,
  onSort: externalOnSort,
  className,
}: TableProps<T>) {
  // Internal sort state (if not controlled externally)
  const [internalSortKey, setInternalSortKey] = useState<string | null>(null)
  const [internalSortDirection, setInternalSortDirection] = useState<SortDirection>(null)

  const sortKey = externalSortKey ?? internalSortKey
  const sortDirection = externalSortDirection ?? internalSortDirection

  // Handle column sort
  const handleSort = (key: string) => {
    const column = columns.find((col) => col.key === key)
    if (!column?.sortable) return

    let newDirection: SortDirection = 'asc'

    if (sortKey === key) {
      if (sortDirection === 'asc') newDirection = 'desc'
      else if (sortDirection === 'desc') newDirection = null
    }

    if (externalOnSort) {
      externalOnSort(key, newDirection)
    } else {
      setInternalSortKey(newDirection ? key : null)
      setInternalSortDirection(newDirection)
    }
  }

  // Sort data
  const sortedData = [...data]
  if (sortKey && sortDirection) {
    sortedData.sort((a, b) => {
      const aValue = getNestedValue(a, sortKey)
      const bValue = getNestedValue(b, sortKey)

      if (aValue == null) return 1
      if (bValue == null) return -1

      if (aValue < bValue) return sortDirection === 'asc' ? -1 : 1
      if (aValue > bValue) return sortDirection === 'asc' ? 1 : -1
      return 0
    })
  }

  return (
    <div className={cn('bg-white rounded-xl overflow-hidden', bordered && 'border border-slate-200 shadow-sm', className)}>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          {/* Header */}
          <thead className="bg-slate-50 border-b border-slate-200">
            <tr>
              {columns.map((column) => (
                <th
                  key={column.key}
                  onClick={() => column.sortable && handleSort(column.key)}
                  className={cn(
                    'px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide whitespace-nowrap',
                    column.sortable && 'cursor-pointer select-none hover:bg-slate-100 transition-colors',
                    column.align === 'center' && 'text-center',
                    column.align === 'right' && 'text-right',
                    column.hideOnMobile && 'hidden md:table-cell'
                  )}
                  style={{ width: column.width }}
                >
                  <div className="flex items-center gap-2">
                    <span>{column.label}</span>
                    {column.sortable && sortKey === column.key && (
                      <span className="material-symbols-outlined text-sm">
                        {sortDirection === 'asc' ? 'arrow_upward' : 'arrow_downward'}
                      </span>
                    )}
                  </div>
                </th>
              ))}
            </tr>
          </thead>

          {/* Body */}
          <tbody className="divide-y divide-slate-100">
            {loading ? (
              // Loading skeleton
              Array.from({ length: 5 }).map((_, i) => (
                <tr key={i}>
                  {columns.map((column) => (
                    <td
                      key={column.key}
                      className={cn(
                        'px-4 py-3',
                        column.hideOnMobile && 'hidden md:table-cell'
                      )}
                    >
                      <div className="h-4 bg-slate-200 rounded animate-pulse" />
                    </td>
                  ))}
                </tr>
              ))
            ) : sortedData.length === 0 ? (
              // Empty state
              <tr>
                <td colSpan={columns.length} className="px-4 py-12 text-center text-slate-400">
                  {emptyMessage}
                </td>
              </tr>
            ) : (
              // Data rows
              sortedData.map((row, rowIndex) => (
                <tr
                  key={rowKey(row)}
                  onClick={() => onRowClick?.(row, rowIndex)}
                  className={cn(
                    striped && rowIndex % 2 === 1 && 'bg-slate-50/50',
                    hoverable && 'hover:bg-slate-50 transition-colors',
                    onRowClick && 'cursor-pointer'
                  )}
                >
                  {columns.map((column) => {
                    const value = getNestedValue(row, column.key)
                    const content = column.render ? column.render(value, row, rowIndex) : value

                    return (
                      <td
                        key={column.key}
                        className={cn(
                          'px-4 py-3 text-slate-700',
                          column.align === 'center' && 'text-center',
                          column.align === 'right' && 'text-right',
                          column.hideOnMobile && 'hidden md:table-cell'
                        )}
                      >
                        {content}
                      </td>
                    )
                  })}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}

Table.displayName = 'Table'
