import { useState } from 'react'

interface Props {
  onAuthenticated: (token: string) => void
}

type Step = 'credentials' | 'otp'

export function AdminLogin({ onAuthenticated }: Props) {
  const [step, setStep] = useState<Step>('credentials')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [otp, setOtp] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [resending, setResending] = useState(false)
  const [showPw, setShowPw] = useState(false)

  const API = import.meta.env.VITE_API_URL ?? ''

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      const res = await fetch(`${API}/api/admin/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.detail || 'Error')
      setStep('otp')
    } catch (err: any) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const handleVerify = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      const res = await fetch(`${API}/api/admin/verify-otp`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, code: otp }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.detail || 'Error')
      localStorage.setItem('pawtalk-admin-token', data.access_token)
      onAuthenticated(data.access_token)
    } catch (err: any) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const handleResend = async () => {
    setResending(true)
    setError('')
    try {
      const res = await fetch(`${API}/api/admin/resend-otp`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      })
      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.detail || 'Error')
      }
      setOtp('')
    } catch (err: any) {
      setError(err.message)
    } finally {
      setResending(false)
    }
  }

  const inputCls = "w-full px-4 py-3 bg-surface border border-border rounded-xl text-text placeholder-text-muted text-sm focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary transition-all"

  return (
    <div className="min-h-dvh flex flex-col items-center justify-start px-4 py-10 bg-bg">
      <div className="w-full max-w-sm space-y-8">
        <div className="text-center">
          <div className="text-5xl mb-4">🐾</div>
          <h1 className="text-2xl font-extrabold text-text">PawTalk Admin</h1>
          <p className="text-sm text-text-muted mt-1">Panel de administracion</p>
        </div>

        {step === 'credentials' ? (
          <form onSubmit={handleLogin} className="space-y-3">
            <input
              type="email"
              placeholder="Email admin"
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
                autoComplete="current-password"
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
              {loading ? 'Verificando...' : 'Ingresar'}
            </button>
          </form>
        ) : (
          <div className="space-y-4">
            <div className="p-4 rounded-xl bg-primary/10 border border-primary/30 text-center space-y-1">
              <p className="text-sm text-text font-medium">Codigo enviado a</p>
              <p className="text-primary-light font-bold text-sm">{email}</p>
            </div>

            <form onSubmit={handleVerify} className="space-y-3">
              <input
                type="text"
                inputMode="numeric"
                placeholder="000000"
                value={otp}
                onChange={e => {
                  const v = e.target.value.replace(/\D/g, '').slice(0, 6)
                  setOtp(v)
                }}
                className={`${inputCls} text-center text-2xl font-bold tracking-[0.5em]`}
                maxLength={6}
                autoFocus
                required
              />

              {error && (
                <div className="p-3 rounded-xl bg-danger/10 border border-danger/30 text-danger text-sm text-center">
                  {error}
                </div>
              )}

              <button
                type="submit"
                disabled={loading || otp.length !== 6}
                className="w-full py-3.5 rounded-xl bg-primary text-white font-bold text-base shadow-lg shadow-primary/30 hover:brightness-110 active:scale-95 disabled:opacity-50 transition-all"
              >
                {loading ? 'Verificando...' : 'Verificar codigo'}
              </button>
            </form>

            <div className="flex items-center justify-between">
              <button
                onClick={() => { setStep('credentials'); setOtp(''); setError('') }}
                className="text-xs text-text-muted hover:text-text transition-colors"
              >
                Volver
              </button>
              <button
                onClick={handleResend}
                disabled={resending}
                className="text-xs text-primary-light hover:text-primary transition-colors disabled:opacity-50"
              >
                {resending ? 'Reenviando...' : 'Reenviar codigo'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
