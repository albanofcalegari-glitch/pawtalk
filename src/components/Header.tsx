import { useState } from 'react'
import { useAuth } from '../lib/auth'
import type { ClassificationResult } from '../lib/audioClassifier'
import { getLabel } from '../lib/audioClassifier'

interface Props {
  isListening: boolean
  currentResult: ClassificationResult | null
}

export function Header({ isListening, currentResult }: Props) {
  const { user, logout } = useAuth()
  const [menuOpen, setMenuOpen] = useState(false)
  const showDetection = isListening && currentResult && currentResult.type !== 'silence'

  return (
    <header className="sticky top-0 z-20 border-b border-border/50 bg-bg/60 backdrop-blur-2xl">
      <div className="max-w-lg mx-auto flex items-center justify-between px-4 py-3">
        <div className="flex items-center gap-2.5">
          <div className="relative">
            <span className="text-2xl">🐾</span>
            {isListening && (
              <span className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-success border-2 border-bg" />
            )}
          </div>
          <div>
            <h1 className="text-base font-extrabold text-text tracking-tight">PawTalk</h1>
            <p className="text-[10px] text-text-muted font-medium -mt-0.5">Traductor canino</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Live status pill */}
          <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-semibold transition-all duration-300 ${
            showDetection
              ? 'bg-accent/15 border border-accent/40 text-accent-light'
              : isListening
              ? 'bg-success/10 border border-success/30 text-success-light'
              : 'bg-surface border border-border text-text-muted'
          }`}>
            <span className={`w-2 h-2 rounded-full ${
              showDetection
                ? 'bg-accent animate-ping'
                : isListening
                ? 'bg-success animate-pulse'
                : 'bg-text-muted/50'
            }`} />
            {showDetection
              ? getLabel(currentResult!.type)
              : isListening
              ? 'Escuchando'
              : 'Inactivo'}
          </div>

          {/* User menu */}
          <div className="relative">
            <button
              onClick={() => setMenuOpen(!menuOpen)}
              className="w-8 h-8 rounded-full bg-primary/20 border border-primary/30 flex items-center justify-center text-xs font-bold text-primary-light"
            >
              {user?.name?.charAt(0).toUpperCase()}
            </button>
            {menuOpen && (
              <>
                <div className="fixed inset-0 z-30" onClick={() => setMenuOpen(false)} />
                <div className="absolute right-0 top-10 z-40 w-48 bg-surface border border-border rounded-xl shadow-xl p-2 animate-slide-up">
                  <div className="px-3 py-2 border-b border-border mb-1">
                    <p className="text-sm font-medium text-text truncate">{user?.name}</p>
                    <p className="text-[11px] text-text-muted truncate">{user?.email}</p>
                  </div>
                  <button
                    onClick={() => { logout(); setMenuOpen(false) }}
                    className="w-full text-left px-3 py-2 rounded-lg text-sm text-danger hover:bg-danger/10 transition-colors"
                  >
                    Cerrar sesión
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </header>
  )
}
