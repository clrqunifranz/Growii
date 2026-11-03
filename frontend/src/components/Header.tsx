interface HeaderProps {
  demoMode: boolean
  onVoiceMode?: () => void
}

export function Header({ demoMode, onVoiceMode }: HeaderProps) {
  return (
    <header className="site-header">
      <div className="site-header__top">
        <p className="identity">
          <span className="identity__mark" aria-hidden="true" />
          RED ALUMNI <span className="identity__slash">/</span> UNIFRANZ
        </p>
        <p className="header-meta">
          ASISTENTE ALMA <span aria-hidden="true">·</span> ES-BO
          {onVoiceMode && (
            <button type="button" className="header-meta__voice" onClick={onVoiceMode}>
              VOZ
            </button>
          )}
        </p>
      </div>

      <div className="site-header__title-row">
        <div className="wordmark-wrap">
          <h1 className="wordmark">ALMA</h1>
          <span className="wordmark__index" aria-hidden="true">
            01
          </span>
        </div>
        <p className="site-header__subtitle">
          Asistente de empleabilidad y Red Alumni
          <span>Coordinación de Empleabilidad · UNIFRANZ</span>
        </p>
      </div>

      {demoMode && (
        <div className="demo-banner" role="status">
          <strong>MODO DEMO LOCAL</strong>
          <span>Respuestas de prueba · no provienen de ALMA</span>
        </div>
      )}
    </header>
  )
}
