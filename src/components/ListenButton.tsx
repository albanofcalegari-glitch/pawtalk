interface Props {
  isListening: boolean
  dogName: string
  onStart: () => void
  onStop: () => void
}

export function ListenButton({ isListening, dogName, onStart, onStop }: Props) {
  return (
    <div className="relative flex flex-col items-center gap-4 py-4">
      {/* Pulse rings when listening */}
      {isListening && (
        <>
          <div className="absolute inset-0 m-auto w-32 h-32 rounded-full bg-primary/20 animate-pulse-ring" />
          <div className="absolute inset-0 m-auto w-32 h-32 rounded-full bg-primary/10 animate-pulse-ring [animation-delay:0.5s]" />
        </>
      )}

      {/* Main button */}
      <button
        onClick={isListening ? onStop : onStart}
        className={`relative z-10 w-28 h-28 rounded-full flex items-center justify-center transition-all duration-300 ${
          isListening
            ? 'bg-gradient-to-br from-danger to-danger-light shadow-2xl shadow-danger/40 scale-95'
            : 'bg-gradient-to-br from-primary to-primary-glow shadow-2xl shadow-primary/40 hover:scale-105 hover:shadow-primary/60 animate-glow'
        }`}
      >
        {isListening ? (
          <svg className="w-10 h-10 text-white" fill="currentColor" viewBox="0 0 24 24">
            <rect x="6" y="6" width="12" height="12" rx="2" />
          </svg>
        ) : (
          <svg className="w-10 h-10 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 18.75a6 6 0 006-6v-1.5m-6 7.5a6 6 0 01-6-6v-1.5m6 7.5v3.75m-3.75 0h7.5M12 15.75a3 3 0 01-3-3V4.5a3 3 0 116 0v8.25a3 3 0 01-3 3z" />
          </svg>
        )}
      </button>

      <p className={`text-sm font-semibold transition-colors ${isListening ? 'text-danger-light' : 'text-text-secondary'}`}>
        {isListening ? 'Tocá para detener' : `Escuchar a ${dogName}`}
      </p>
    </div>
  )
}
