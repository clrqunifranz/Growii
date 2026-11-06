export type ChatStatus = 'idle' | 'thinking' | 'listening' | 'speaking'

const STATUS_LABELS: Record<ChatStatus, string> = {
  idle: 'EN LÍNEA',
  thinking: 'ALMA ESTÁ PENSANDO',
  listening: 'ESCUCHANDO',
  speaking: 'ALMA ESTÁ HABLANDO',
}

interface StatusIndicatorsProps {
  status: ChatStatus
}

export function StatusIndicators({ status }: StatusIndicatorsProps) {
  return (
    <div
      className={`status status--${status}`}
      role="status"
      aria-live="polite"
    >
      {status === 'speaking' ? (
        <span className="status__equalizer" aria-hidden="true">
          <i />
          <i />
          <i />
          <i />
        </span>
      ) : (
        <span className="status__dot" aria-hidden="true" />
      )}
      <span className="status__label">{STATUS_LABELS[status]}</span>
    </div>
  )
}
