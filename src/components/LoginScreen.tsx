import { useState } from 'react'
import { useAuth } from '../lib/auth'

export function LoginScreen() {
  const { login, register } = useAuth()
  const [mode, setMode] = useState<'login' | 'register'>('register')
  const [email, setEmail] = useState('')
  const [name, setName] = useState('')
  const [password, setPassword] = useState('')
  const [neighborhood, setNeighborhood] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [showPw, setShowPw] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      if (mode === 'register') {
        await register(email, name, password, neighborhood || undefined)
      } else {
        await login(email, password)
      }
    } catch (err: any) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const inputCls = "w-full px-4 py-3 bg-surface border border-border rounded-xl text-text placeholder-text-muted text-sm focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary transition-all"

  return (
    <div className="min-h-dvh flex flex-col items-center justify-start px-4 py-10 bg-bg safe-area-inset">
      <div className="w-full max-w-sm space-y-8">
        {/* Logo */}
        <div className="text-center">
          <div className="text-6xl mb-4">🐾</div>
          <h1 className="text-2xl font-extrabold text-text">PawTalk</h1>
          <p className="text-sm text-text-muted mt-1">Traductor canino inteligente</p>
        </div>

        {/* Tab switcher */}
        <div className="flex gap-1 p-1 bg-surface border border-border rounded-xl">
          <button
            type="button"
            onClick={() => { setMode('register'); setError('') }}
            className={`flex-1 py-2.5 rounded-lg text-sm font-semibold transition-all ${
              mode === 'register'
                ? 'bg-primary/15 text-primary-light border border-primary/30'
                : 'text-text-muted hover:text-text-secondary'
            }`}
          >
            Registrarme
          </button>
          <button
            type="button"
            onClick={() => { setMode('login'); setError('') }}
            className={`flex-1 py-2.5 rounded-lg text-sm font-semibold transition-all ${
              mode === 'login'
                ? 'bg-primary/15 text-primary-light border border-primary/30'
                : 'text-text-muted hover:text-text-secondary'
            }`}
          >
            Ya tengo cuenta
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-3">
          {mode === 'register' && (
            <input
              type="text"
              placeholder="Tu nombre"
              value={name}
              onChange={e => setName(e.target.value)}
              className={inputCls}
              required
              autoComplete="name"
            />
          )}
          <input
            type="text"
            placeholder="Barrio o zona (ej: Boedo, CABA)"
            value={neighborhood}
            onChange={e => setNeighborhood(e.target.value)}
            className={inputCls}
            autoComplete="address-level2"
          />
          <input
            type="email"
            placeholder="Email"
            value={email}
            onChange={e => setEmail(e.target.value)}
            className={inputCls}
            required
            autoComplete="email"
            inputMode="email"
          />
          <div className="relative">
            <input
              type={showPw ? 'text' : 'password'}
              placeholder="Contraseña"
              value={password}
              onChange={e => setPassword(e.target.value)}
              className={`${inputCls} pr-11`}
              required
              minLength={4}
              autoComplete={mode === 'register' ? 'new-password' : 'current-password'}
            />
            <button
              type="button"
              onClick={() => setShowPw(!showPw)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-text-muted hover:text-text transition-colors p-1"
            >
              {showPw ? (
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3.98 8.223A10.477 10.477 0 001.934 12C3.226 16.338 7.244 19.5 12 19.5c.993 0 1.953-.138 2.863-.395M6.228 6.228A10.45 10.45 0 0112 4.5c4.756 0 8.773 3.162 10.065 7.498a10.523 10.523 0 01-4.293 5.774M6.228 6.228L3 3m3.228 3.228l3.65 3.65m7.894 7.894L21 21m-3.228-3.228l-3.65-3.65m0 0a3 3 0 10-4.243-4.243m4.242 4.242L9.88 9.88" />
                </svg>
              ) : (
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z" />
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
              )}
            </button>
          </div>

          {error && (
            <div className="p-3 rounded-xl bg-danger/10 border border-danger/30 text-danger text-sm text-center">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3.5 rounded-xl bg-primary text-white font-bold text-base shadow-lg shadow-primary/30 hover:brightness-110 active:scale-95 disabled:opacity-50 transition-all"
          >
            {loading ? 'Cargando...' : mode === 'login' ? 'Ingresar' : 'Crear cuenta'}
          </button>
        </form>

        {mode === 'register' && (
          <p className="text-center text-xs text-text-muted/70 px-4">
            Registrate para empezar a grabar los sonidos de tu perro y ayudar a entrenar el traductor canino
          </p>
        )}
      </div>
    </div>
  )
}
