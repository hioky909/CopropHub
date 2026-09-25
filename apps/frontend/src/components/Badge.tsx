type BadgeVariant = 'success' | 'warning' | 'danger' | 'neutral' | 'info';

const STYLES: Record<BadgeVariant, { bg: string; color: string; dot: string }> = {
  success: { bg: 'var(--color-success-light)', color: 'var(--color-success)', dot: 'var(--color-success)' },
  warning: { bg: 'var(--color-warning-light)', color: 'var(--color-warning)', dot: 'var(--color-warning)' },
  danger: { bg: 'var(--color-danger-light)', color: 'var(--color-danger)', dot: 'var(--color-danger)' },
  neutral: { bg: 'var(--color-neutral-100)', color: 'var(--color-neutral-500)', dot: 'var(--color-neutral-400)' },
  info: { bg: 'var(--color-info-light)', color: 'var(--color-info)', dot: 'var(--color-info)' },
};

interface BadgeProps {
  variant: BadgeVariant;
  label: string;
  dot?: boolean;
}

export default function Badge({ variant, label, dot = true }: BadgeProps) {
  const s = STYLES[variant];
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 5,
        padding: '2px 8px',
        borderRadius: 4,
        fontSize: 12,
        fontWeight: 500,
        letterSpacing: '0.01em',
        backgroundColor: s.bg,
        color: s.color,
        whiteSpace: 'nowrap',
      }}
    >
      {dot && (
        <span
          aria-hidden="true"
          style={{
            width: 6,
            height: 6,
            borderRadius: '50%',
            backgroundColor: s.dot,
            flexShrink: 0,
          }}
        />
      )}
      {label}
    </span>
  );
}
