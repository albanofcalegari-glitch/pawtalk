import { useState } from 'react'
import { useAuth } from '../lib/auth'

export function LoginScreen() {
  const { login, register } = useAuth()
  const [mode, setMode] = useState<'login' | 'register'>('register')
  const [email, setEmail] = useState('')
  const [name, setName] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      if (mode === 'register') {
        await register(email, name, password)
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
            type="email"
            placeholder="Email"
            value={email}
            onChange={e => setEmail(e.target.value)}
            className={inputCls}
            required
            autoComplete="email"
            inputMode="email"
          />
          <input
            type="password"
            placeholder="Contraseña"
            value={password}
            onChange={e => setPassword(e.target.value)}
            className={inputCls}
            required
            minLength={4}
            autoComplete={mode === 'register' ? 'new-password' : 'current-password'}
          />

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
