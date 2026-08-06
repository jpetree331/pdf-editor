// Shared UI primitives: Button, IconButton, Modal, ProgressOverlay.
// Hand-rolled — no component library, per house convention.
import { useEffect, useRef, type ReactNode } from 'react'
import { Icon } from './Icon'
import './primitives.css'

export function Button({
  children,
  onClick,
  variant = 'default',
  disabled,
  title,
}: {
  children: ReactNode
  onClick?: () => void
  variant?: 'default' | 'primary' | 'danger' | 'ghost'
  disabled?: boolean
  title?: string
}) {
  return (
    <button className={`btn btn-${variant}`} onClick={onClick} disabled={disabled} title={title}>
      {children}
    </button>
  )
}

export function IconButton({
  icon,
  label,
  onClick,
  active,
  disabled,
  size = 20,
}: {
  icon: string
  label: string
  onClick?: () => void
  active?: boolean
  disabled?: boolean
  size?: number
}) {
  return (
    <button
      className={`icon-btn${active ? ' icon-btn-active' : ''}`}
      onClick={onClick}
      disabled={disabled}
      title={label}
      aria-label={label}
      aria-pressed={active}
    >
      <Icon name={icon} size={size} />
    </button>
  )
}

export function Modal({
  title,
  onClose,
  children,
  wide,
}: {
  title: string
  onClose: () => void
  children: ReactNode
  wide?: boolean
}) {
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    ref.current?.querySelector<HTMLElement>('input, button, textarea')?.focus()
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  return (
    <div className="modal-backdrop" onPointerDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className={`modal${wide ? ' modal-wide' : ''}`} role="dialog" aria-label={title} ref={ref}>
        <div className="modal-header">
          <h2>{title}</h2>
          <IconButton icon="close" label="Close" onClick={onClose} />
        </div>
        <div className="modal-body">{children}</div>
      </div>
    </div>
  )
}

export function ProgressOverlay({ message, percent }: { message: string; percent: number | null }) {
  return (
    <div className="progress-backdrop">
      <div className="progress-card">
        <div className="progress-message">{message}</div>
        <div className="progress-track">
          <div
            className={`progress-fill${percent === null ? ' progress-indeterminate' : ''}`}
            style={percent === null ? undefined : { width: `${Math.round(percent * 100)}%` }}
          />
        </div>
      </div>
    </div>
  )
}
