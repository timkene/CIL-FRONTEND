'use client'

import { useMemo } from 'react'
import { cn } from '@/lib/utils/cn'
import { Button } from '../Button'
import { Table } from './Table'
import type { PaginatedTableProps } from './types'

// ────────────────────────────────────────────────────────────────────────────
// Paginated Table Component
// ────────────────────────────────────────────────────────────────────────────

export function PaginatedTable<T = any>({
  data,
  currentPage = 1,
  pageSize = 10,
  totalItems,
  onPageChange,
  onPageSizeChange,
  showPageSize = true,
  pageSizeOptions = [10, 25, 50, 100],
  ...tableProps
}: PaginatedTableProps<T>) {
  // Calculate pagination
  const total = totalItems ?? data.length
  const totalPages = Math.ceil(total / pageSize)
  const startIndex = (currentPage - 1) * pageSize
  const endIndex = startIndex + pageSize

  // Paginate data (client-side) if not using server-side pagination
  const paginatedData = totalItems ? data : data.slice(startIndex, endIndex)

  // Page numbers to show (max 7 pages: 1 ... 4 5 6 ... 10)
  const pageNumbers = useMemo(() => {
    const pages: (number | string)[] = []

    if (totalPages <= 7) {
      // Show all pages
      for (let i = 1; i <= totalPages; i++) {
        pages.push(i)
      }
    } else {
      // Always show first page
      pages.push(1)

      if (currentPage > 3) {
        pages.push('...')
      }

      // Show pages around current page
      const start = Math.max(2, currentPage - 1)
      const end = Math.min(totalPages - 1, currentPage + 1)

      for (let i = start; i <= end; i++) {
        pages.push(i)
      }

      if (currentPage < totalPages - 2) {
        pages.push('...')
      }

      // Always show last page
      if (totalPages > 1) {
        pages.push(totalPages)
      }
    }

    return pages
  }, [currentPage, totalPages])

  const handlePageChange = (page: number) => {
    if (page < 1 || page > totalPages) return
    onPageChange?.(page)
  }

  return (
    <div className="space-y-4">
      {/* Table */}
      <Table {...tableProps} data={paginatedData} />

      {/* Pagination Controls */}
      {totalPages > 1 && (
        <div className="flex flex-wrap items-center justify-between gap-4 px-4">
          {/* Info */}
          <div className="text-sm text-slate-500">
            Showing {startIndex + 1} to {Math.min(endIndex, total)} of {total} results
          </div>

          {/* Page Size Selector */}
          <div className="flex items-center gap-4">
            {showPageSize && (
              <div className="flex items-center gap-2">
                <span className="text-sm text-slate-600">Rows per page:</span>
                <select
                  value={pageSize}
                  onChange={(e) => onPageSizeChange?.(Number(e.target.value))}
                  className="px-2 py-1 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-400"
                >
                  {pageSizeOptions.map((size) => (
                    <option key={size} value={size}>
                      {size}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {/* Page Numbers */}
            <div className="flex items-center gap-1">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => handlePageChange(currentPage - 1)}
                disabled={currentPage === 1}
                leftIcon={<span className="material-symbols-outlined">chevron_left</span>}
              >
                Previous
              </Button>

              {pageNumbers.map((page, index) =>
                page === '...' ? (
                  <span key={`ellipsis-${index}`} className="px-2 text-slate-400">
                    ...
                  </span>
                ) : (
                  <button
                    key={page}
                    onClick={() => handlePageChange(page as number)}
                    className={cn(
                      'px-3 py-1.5 text-sm font-medium rounded-lg transition-colors',
                      currentPage === page
                        ? 'bg-blue-500 text-white'
                        : 'text-slate-600 hover:bg-slate-100'
                    )}
                  >
                    {page}
                  </button>
                )
              )}

              <Button
                variant="ghost"
                size="sm"
                onClick={() => handlePageChange(currentPage + 1)}
                disabled={currentPage === totalPages}
                rightIcon={<span className="material-symbols-outlined">chevron_right</span>}
              >
                Next
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

PaginatedTable.displayName = 'PaginatedTable'
