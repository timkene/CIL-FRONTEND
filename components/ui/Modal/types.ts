import { ReactNode } from 'react'

export interface ModalProps {
  /**
   * Whether the modal is open
   */
  open: boolean

  /**
   * Callback when modal should close
   */
  onClose: () => void

  /**
   * Modal title
   */
  title?: string

  /**
   * Modal size
   * @default 'md'
   */
  size?: 'sm' | 'md' | 'lg' | 'xl' | 'full'

  /**
   * Whether clicking the backdrop closes the modal
   * @default true
   */
  closeOnBackdropClick?: boolean

  /**
   * Whether pressing Escape closes the modal
   * @default true
   */
  closeOnEscape?: boolean

  /**
   * Whether to show the close button in the header
   * @default true
   */
  showCloseButton?: boolean

  /**
   * Modal content
   */
  children: ReactNode

  /**
   * Optional footer content (typically action buttons)
   */
  footer?: ReactNode

  /**
   * Additional CSS classes for the modal container
   */
  className?: string
}
