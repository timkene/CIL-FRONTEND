import { ReactNode } from 'react'

export type SortDirection = 'asc' | 'desc' | null

export interface Column<T = any> {
  /**
   * Unique column key (maps to data field)
   */
  key: string

  /**
   * Column header label
   */
  label: string

  /**
   * Whether this column is sortable
   * @default false
   */
  sortable?: boolean

  /**
   * Custom render function for cell content
   */
  render?: (value: any, row: T, index: number) => ReactNode

  /**
   * Column width (CSS value)
   */
  width?: string

  /**
   * Column alignment
   * @default 'left'
   */
  align?: 'left' | 'center' | 'right'

  /**
   * Whether to hide on mobile
   * @default false
   */
  hideOnMobile?: boolean
}

export interface TableProps<T = any> {
  /**
   * Column definitions
   */
  columns: Column<T>[]

  /**
   * Table data
   */
  data: T[]

  /**
   * Unique key extractor for rows
   * @default (row) => row.id
   */
  rowKey?: (row: T) => string | number

  /**
   * Loading state
   * @default false
   */
  loading?: boolean

  /**
   * Empty state message
   * @default 'No data available'
   */
  emptyMessage?: string

  /**
   * Whether to show border
   * @default true
   */
  bordered?: boolean

  /**
   * Whether to show striped rows
   * @default false
   */
  striped?: boolean

  /**
   * Whether rows are hoverable
   * @default true
   */
  hoverable?: boolean

  /**
   * Row click handler
   */
  onRowClick?: (row: T, index: number) => void

  /**
   * Current sort column key
   */
  sortKey?: string

  /**
   * Current sort direction
   */
  sortDirection?: SortDirection

  /**
   * Sort change handler
   */
  onSort?: (key: string, direction: SortDirection) => void

  /**
   * Additional CSS classes for table
   */
  className?: string
}

export interface PaginatedTableProps<T = any> extends TableProps<T> {
  /**
   * Current page (1-indexed)
   * @default 1
   */
  currentPage?: number

  /**
   * Items per page
   * @default 10
   */
  pageSize?: number

  /**
   * Total number of items (for server-side pagination)
   */
  totalItems?: number

  /**
   * Page change handler
   */
  onPageChange?: (page: number) => void

  /**
   * Page size change handler
   */
  onPageSizeChange?: (size: number) => void

  /**
   * Whether to show page size selector
   * @default true
   */
  showPageSize?: boolean

  /**
   * Available page sizes
   * @default [10, 25, 50, 100]
   */
  pageSizeOptions?: number[]
}
