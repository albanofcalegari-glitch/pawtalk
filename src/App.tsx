import { useState, useCallback } from 'react'
import { useAuth } from './lib/auth'
import { useAudioCapture } from './hooks/useAudioCapture'
import { AudioVisualizer } from './components/AudioVisualizer'
import { DetectionCard } from './components/DetectionCard'
import { ListenButton } from './components/ListenButton'
import { Header } from './components/Header'
import { RecordMode } from './components/RecordMode'
import { LoginScreen } from './components/LoginScreen'
import { OnboardingDogs } from './components/OnboardingDogs'
import type { ClassificationResult } from './lib/audioClassifier'

interface DetectionEvent {
  id: number
  result: ClassificationResult
  timestamp: Date
  dog: string
}

let nextId = 0

type Tab = 'listen' | 'record'

export default function App() {
  const { user, dogs, loading } = useAuth()

  if (loading) {
    return (
      <div className="min-h-dvh flex items-center justify-center bg-bg">
        <div className="flex flex-col items-center gap-3">
          <div className="w-10 h-10 border-3 border-primary border-t-transparent rounded-full animate-spin" />
          <p className="text-sm text-text-muted">Cargando...</p>
        </div>
      </div>
    )
  }

  if (!user) return <LoginScreen />
  if (dogs.length === 0) return <OnboardingDogs />

  return <MainApp />
}

function MainApp() {
  const { dogs } = useAuth()
  const [tab, setTab] = useState<Tab>('listen')
  const [history, setHistory] = useState<DetectionEvent[]>([])
  const [selectedDogIdx, setSelectedDogIdx] = useState(0)

  const selectedDog = dogs[selectedDogIdx] || dogs[0]

  const handleDetection = useCallback((result: ClassificationResult) => {
    setHistory(prev => [{
      id: nextId++,
      result,
      timestamp: new Date(),
      dog: selectedDog?.name || '',
    }, ...prev].slice(0, 50))
  }, [selectedDog])

  const { isListening, currentResult, error, start, stop, analyser } = useAudioCapture(handleDetection)

  return (
    <div className="flex flex-col min-h-dvh">
      <Header isListening={isListening} currentResult={currentResult} />

      <main className="flex-1 max-w-lg mx-auto w-full px-4 py-5 space-y-5">
        {/* Dog selector from backend */}
        <div className="grid gap-2" style={{ gridTemplateColumns: `repeat(${Math.min(dogs.length, 3)}, 1fr)` }}>
          {dogs.map((dog, idx) => (
            <button
              key={dog.id}
              onClick={() => setSelectedDogIdx(idx)}
              className={`relative overflow-hidden rounded-2xl p-3 border-2 transition-all duration-200 ${
                selectedDogIdx === idx
                  ? 'border-primary/50 bg-primary/10 scale-[1.02] shadow-lg'
                  : 'border-border bg-surface hover:bg-surface-light hover:border-border-light'
              }`}
            >
              <div className="flex flex-col items-center gap-2">
                {dog.photo_url ? (
                  <img
                    src={`${import.meta.env.VITE_API_URL || 'http://localhost:8000'}${dog.photo_url}`}
                    className="w-12 h-12 rounded-full object-cover border-2 border-border"
                  />
                ) : (
                  <div className="w-12 h-12 rounded-full bg-surface-light flex items-center justify-center text-2xl">
                    🐕
                  </div>
                )}
                <div className="text-center">
                  <p className={`font-bold text-sm ${selectedDogIdx === idx ? 'text-primary-light' : 'text-text'}`}>
                    {dog.name}
                  </p>
                  <p className="text-[10px] text-text-muted">{dog.breed}</p>
                </div>
              </div>
            </button>
          ))}
        </div>

        {/* Tab switcher */}
        <div className="flex gap-1 p-1 bg-surface border border-border rounded-2xl">
          <button
            onClick={() => setTab('listen')}
            className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-semibold transition-all ${
              tab === 'listen'
                ? 'bg-primary/15 text-primary-light border border-primary/30'
                : 'text-text-muted hover:text-text-secondary'
            }`}
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M19.114 5.636a9 9 0 010 12.728M16.463 8.288a5.25 5.25 0 010 7.424M6.75 8.25l4.72-4.72a.75.75 0 011.28.53v15.88a.75.75 0 01-1.28.53l-4.72-4.72H4.51c-.88 0-1.704-.507-1.938-1.354A9.01 9.01 0 012.25 12c0-.83.112-1.633.322-2.396C2.806 8.756 3.63 8.25 4.51 8.25H6.75z" />
            </svg>
            Traducir
          </button>
          <button
            onClick={() => setTab('record')}
            className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-semibold transition-all ${
              tab === 'record'
                ? 'bg-danger/15 text-danger-light border border-danger/30'
                : 'text-text-muted hover:text-text-secondary'
            }`}
          >
            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
              <circle cx="12" cy="12" r="6" />
            </svg>
            Grabar datos
          </button>
        </div>

        {tab === 'listen' ? (
          <div className="space-y-5">
            <div className="flex flex-col items-center gap-5">
              <ListenButton
                isListening={isListening}
                dogName={selectedDog?.name || ''}
                onStart={start}
                onStop={stop}
              />
              {error && (
                <div className="w-full p-3 rounded-xl bg-danger/10 border border-danger/30 text-danger text-sm text-center">
                  {error}
                </div>
              )}
              <AudioVisualizer analyser={analyser} isActive={isListening} />
            </div>

            <section className="space-y-3">
              <div className="flex items-center justify-between px-1">
                <h2 className="text-xs font-bold text-text-muted uppercase tracking-widest">
                  Traducciones{history.length > 0 ? ` (${history.length})` : ''}
                </h2>
                {history.length > 0 && (
                  <button
                    onClick={() => setHistory([])}
                    className="text-[11px] text-text-muted hover:text-danger transition-colors font-medium"
                  >
                    Limpiar
                  </button>
                )}
              </div>

              {history.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-14 text-text-muted">
                  <div className="text-5xl mb-4 animate-float">🐕</div>
                  <p className="text-sm font-medium mb-1">Sin traducciones aún</p>
                  <p className="text-xs text-text-muted/70">
                    Tocá el botón para escuchar a {selectedDog?.name}
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  {history.map(event => (
                    <DetectionCard
                      key={event.id}
                      result={event.result}
                      timestamp={event.timestamp}
                      dog={event.dog}
                    />
                  ))}
                </div>
              )}
            </section>
          </div>
        ) : (
          <RecordMode />
        )}
      </main>

      <footer className="border-t border-border/50 px-4 py-4 text-center">
        <p className="text-[11px] text-text-muted/60 font-medium tracking-wide">
          PawTalk v0.1 · Hecho con 💜
        </p>
      </footer>
    </div>
  )
}
