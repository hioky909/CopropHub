import { ReactNode } from 'react'

type NotifVariant = 'success' | 'error' | 'info' | 'warning'

const STYLES: Record<NotifVariant, { bg: string; border: string; icon: string; color: string; label: string }> = {
  success: { bg: 'var(--color-success-light)', border: 'var(--color-success-border)', icon: '✓', color: 'var(--color-success)', label: 'Succès' },
  error:   { bg: 'var(--color-danger-light)', border: 'var(--color-danger-border)', icon: '✕', color: 'var(--color-danger)', label: 'Erreur' },
  info:    { bg: 'var(--color-info-light)', border: 'var(--color-info-border)', icon: 'ℹ', color: 'var(--color-info)', label: 'Information' },
  warning: { bg: 'var(--color-warning-light)', border: 'var(--color-warning-border)', icon: '!', color: 'var(--color-warning)', label: 'Attention' },
}

interface NotificationProps {
  variant: NotifVariant
  title?: string
  children: ReactNode
  onDismiss?: () => void
}

export default function Notification({ variant, title, children, onDismiss }: NotificationProps) {
  const s = STYLES[variant]
  return (
    <div
      role={variant === 'error' || variant === 'warning' ? 'alert' : 'status'}
      style={{
        display: 'flex',
        gap: 12,
        padding: '12px 16px',
        borderRadius: 6,
        border: `1px solid ${s.border}`,
        backgroundColor: s.bg,
      }}
    >
      <span
        aria-hidden="true"
        style={{
          width: 20,
          height: 20,
          borderRadius: '50%',
          backgroundColor: s.color,
          color: 'var(--color-surface)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: 11,
          fontWeight: 700,
          flexShrink: 0,
          marginTop: 1,
        }}
      >
        {s.icon}
      </span>
      <div style={{ flex: 1, minWidth: 0 }}>
        {title && (
          <p style={{ margin: '0 0 2px', fontSize: 14, fontWeight: 600, color: s.color }}>{title}</p>
        )}
        <p style={{ margin: 0, fontSize: 14, color: 'var(--color-neutral-700)', lineHeight: 1.5 }}>{children}</p>
      </div>
      {onDismiss && (
        <button
          onClick={onDismiss}
          aria-label="Fermer"
          style={{
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            color: s.color,
            fontSize: 16,
            padding: 0,
            lineHeight: 1,
            flexShrink: 0,
            opacity: 0.7,
          }}
        >
          ×
        </button>
      )}
    </div>
  )
}
