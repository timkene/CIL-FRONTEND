import { type ClassValue, clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'

/**
 * Merge Tailwind CSS classes without conflicts
 *
 * Combines clsx for conditional classes and tailwind-merge to handle
 * Tailwind class conflicts (e.g., 'px-2 px-4' becomes 'px-4')
 *
 * @example
 * cn('px-2 py-1', 'px-4') // => 'py-1 px-4' (px-4 wins)
 * cn('text-sm', condition && 'font-bold') // => 'text-sm font-bold' (if condition is true)
 */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}
