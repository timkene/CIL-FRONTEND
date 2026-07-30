'use client'
import { useState, useEffect, useCallback, useRef } from 'react'

interface QueryState<T> {
  data:    T | null
  loading: boolean
  error:   string | null
  refetch: () => void
}

/**
 * Generic hook that wraps any async data-fetch with consistent
 * loading / error / refetch state. Re-runs only when `deps` change.
 */
export function useSupabaseQuery<T>(
  queryFn: () => Promise<T>,
  deps: unknown[] = [],
): QueryState<T> {
  const [data,    setData]    = useState<T | null>(null)
  const [loading, setLoading] = useState(true)
  const [error,   setError]   = useState<string | null>(null)

  // Stable ref so the callback identity changes only when deps change
  const queryRef = useRef(queryFn)
  queryRef.current = queryFn

  const execute = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const result = await queryRef.current()
      setData(result)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'An unexpected error occurred')
    } finally {
      setLoading(false)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps)

  useEffect(() => { execute() }, [execute])

  return { data, loading, error, refetch: execute }
}
