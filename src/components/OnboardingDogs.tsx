import { useState } from 'react'
import { useAuth } from '../lib/auth'
import { api } from '../lib/api'

export function OnboardingDogs() {
  const { refreshDogs } = useAuth()
  const [dogs, setDogs] = useState<{ name: string; breed: string; photo: File | null }[]>([
    { name: '', breed: '', photo: null },
  ])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const updateDog = (idx: number, field: string, value: any) => {
    setDogs(prev => prev.map((d, i) => i === idx ? { ...d, [field]: value } : d))
  }

  const addDog = () => {
    if (dogs.length < 5) setDogs(prev => [...prev, { name: '', breed: '', photo: null }])
  }

  const removeDog = (idx: number) => {
    if (dogs.length > 1) setDogs(prev => prev.filter((_, i) => i !== idx))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      for (const dog of dogs) {
        if (!dog.name || !dog.breed) continue
        await api.createDog(dog.name, dog.breed, dog.photo || undefined)
      }
      await refreshDogs()
    } catch (err: any) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const inputCls = "w-full px-3 py-2.5 bg-surface border border-border rounded-xl text-text placeholder-text-muted text-sm focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary transition-all"

  return (
    <div className="min-h-dvh flex flex-col items-center justify-center px-5 bg-bg">
      <div className="w-full max-w-md space-y-6">
        <div className="text-center">
          <div className="text-5xl mb-3">🐕</div>
          <h1 className="text-xl font-extrabold text-text">¿Quiénes son tus perros?</h1>
          <p className="text-sm text-text-muted mt-1">
            Agregá tus perros para que PawTalk los identifique
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {dogs.map((dog, idx) => (
            <div key={idx} className="bg-surface border border-border rounded-2xl p-4 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-text-muted uppercase tracking-wider">
                  Perro {idx + 1}
                </span>
                {dogs.length > 1 && (
                  <button
                    type="button"
                    onClick={() => removeDog(idx)}
                    className="text-xs text-text-muted hover:text-danger transition-colors"
                  >
                    Quitar
                  </button>
                )}
              </div>

              <div className="grid grid-cols-2 gap-3">
                <input
                  type="text"
                  placeholder="Nombre"
                  value={dog.name}
                  onChange={e => updateDog(idx, 'name', e.target.value)}
                  className={inputCls}
                  required
                />
                <input
                  type="text"
                  placeholder="Raza"
                  value={dog.breed}
                  onChange={e => updateDog(idx, 'breed', e.target.value)}
                  className={inputCls}
                  required
                />
              </div>

              {/* Photo */}
              <div>
                <label className="flex items-center gap-3 cursor-pointer">
                  <div className={`w-14 h-14 rounded-xl border-2 border-dashed flex items-center justify-center overflow-hidden transition-colors ${
                    dog.photo ? 'border-primary/50' : 'border-border hover:border-primary/30'
                  }`}>
                    {dog.photo ? (
                      <img src={URL.createObjectURL(dog.photo)} className="w-full h-full object-cover" />
                    ) : (
                      <svg className="w-6 h-6 text-text-muted" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M6.827 6.175A2.31 2.31 0 015.186 7.23c-.38.054-.757.112-1.134.175C2.999 7.58 2.25 8.507 2.25 9.574V18a2.25 2.25 0 002.25 2.25h15A2.25 2.25 0 0021.75 18V9.574c0-1.067-.75-1.994-1.802-2.169a47.865 47.865 0 00-1.134-.175 2.31 2.31 0 01-1.64-1.055l-.822-1.316a2.192 2.192 0 00-1.736-1.039 48.774 48.774 0 00-5.232 0 2.192 2.192 0 00-1.736 1.039l-.821 1.316z" />
                        <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 12.75a4.5 4.5 0 11-9 0 4.5 4.5 0 019 0z" />
                      </svg>
                    )}
                  </div>
                  <div>
                    <p className="text-sm font-medium text-text">{dog.photo ? 'Cambiar foto' : 'Subir foto'}</p>
                    <p className="text-[11px] text-text-muted">Para identificación visual</p>
                  </div>
                  <input
                    type="file"
                    accept="image/*"
                    capture="environment"
                    className="hidden"
                    onChange={e => updateDog(idx, 'photo', e.target.files?.[0] || null)}
                  />
                </label>
              </div>
            </div>
          ))}

          {dogs.length < 5 && (
            <button
              type="button"
              onClick={addDog}
              className="w-full py-2.5 rounded-xl border border-dashed border-border text-text-muted text-sm font-medium hover:border-primary/40 hover:text-primary-light transition-all"
            >
              + Agregar otro perro
            </button>
          )}

          {error && (
            <div className="p-3 rounded-xl bg-danger/10 border border-danger/30 text-danger text-sm text-center">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3.5 rounded-xl bg-primary text-white font-bold text-base shadow-lg shadow-primary/30 hover:brightness-110 disabled:opacity-50 transition-all"
          >
            {loading ? 'Guardando...' : 'Continuar'}
          </button>
        </form>
      </div>
    </div>
  )
}
