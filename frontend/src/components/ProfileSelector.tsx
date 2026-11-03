import type { ProfileOption } from '../data/suggestedQuestions'
import type { ProfileId } from '../types/chat'

interface ProfileSelectorProps {
  options: ProfileOption[]
  selected: ProfileId
  onSelect: (profile: ProfileId) => void
  onSuggestion: (question: string) => void
}

export function ProfileSelector({
  options,
  selected,
  onSelect,
  onSuggestion,
}: ProfileSelectorProps) {
  const selectedOption =
    options.find((option) => option.id === selected) ?? options[0]

  return (
    <>
      <section className="profile-section" aria-labelledby="profile-label">
        <div className="section-label">
          <span id="profile-label">PERFIL</span>
          <span>
            {selectedOption.index} / {String(options.length).padStart(2, '0')}
          </span>
        </div>

        <div className="profile-list" role="group" aria-label="Selecciona tu perfil">
          {options.map((option) => (
            <button
              key={option.id}
              type="button"
              className={`profile-button ${
                option.id === selected ? 'is-active' : ''
              }`}
              aria-pressed={option.id === selected}
              onClick={() => onSelect(option.id)}
            >
              <span className="profile-button__index">{option.index}</span>
              <span className="profile-button__label">{option.label}</span>
              <span className="profile-button__arrow" aria-hidden="true">
                →
              </span>
            </button>
          ))}
        </div>
      </section>

      <section className="suggestions" aria-labelledby="suggestions-label">
        <div className="section-label">
          <span id="suggestions-label">PREGUNTAS</span>
          <span>
            {String(selectedOption.questions.length).padStart(2, '0')}
          </span>
        </div>

        <ul className="suggestion-list">
          {selectedOption.questions.map((question, index) => (
            <li key={question}>
              <button
                type="button"
                className="suggestion-button"
                onClick={() => onSuggestion(question)}
              >
                <span className="suggestion-button__index">
                  {String(index + 1).padStart(2, '0')}
                </span>
                <span className="suggestion-button__text">{question}</span>
                <span className="suggestion-button__arrow" aria-hidden="true">
                  ↗
                </span>
              </button>
            </li>
          ))}
        </ul>
      </section>
    </>
  )
}
