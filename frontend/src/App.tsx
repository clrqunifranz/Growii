import { useState } from 'react'
import './App.css'
import './styles/voice.css'
import './styles/avatar.css'
import { TextExperience } from './components/TextExperience'
import { VoiceExperience } from './components/VoiceExperience'
import { useConversation } from './hooks/useConversation'
import { useSpeechSynthesis } from './hooks/useSpeechSynthesis'
import { DEMO_MODE } from './services/chatApi'

export default function App() {
  const [mode, setMode] = useState<'voice' | 'text'>('voice')
  const conversation = useConversation()
  const synthesis = useSpeechSynthesis()

  return (
    <>
      <div
        className={mode === 'voice' ? 'experience-shell' : 'experience-hidden'}
        aria-hidden={mode !== 'voice'}
      >
        <VoiceExperience
          conversation={conversation}
          synthesis={synthesis}
          demoMode={DEMO_MODE}
          onOpenText={() => setMode('text')}
        />
      </div>

      <div
        className={mode === 'text' ? 'experience-shell' : 'experience-hidden'}
        aria-hidden={mode !== 'text'}
      >
        <TextExperience
          conversation={conversation}
          synthesis={synthesis}
          demoMode={DEMO_MODE}
          onVoiceMode={() => setMode('voice')}
          isVisible={mode === 'text'}
        />
      </div>
    </>
  )
}
