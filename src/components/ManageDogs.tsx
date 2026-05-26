import { useState } from 'react'
import { useAuth } from '../lib/auth'
import { api, type DogResponse } from '../lib/api'

const BREEDS = [
  'Labrador', 'Golden Retriever', 'Pastor Alemán', 'Bulldog Francés',
  'Caniche', 'Chihuahua', 'Salchicha (Dachshund)', 'Beagle', 'Yorkshire',
  'Pitbull', 'Boxer', 'Rottweiler', 'Husky Siberiano', 'Border Collie',
  'Cocker Spaniel', 'Schnauzer', 'Pomerania', 'Mestizo',
]

interface Props {
  open: boolean
  onClose: () => void
}

export function ManageDogs({ open, onClose }: Props) {
  const { dogs, refreshDogs } = useAuth()
  const [adding, setAdding] = useState(false)
  const [name, setName] = useState('')
  const [breed, setBreed] = useState('')
  const [photo, setPhoto] = useState<File | null>(null)
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState<number | null>(null)
  const [error, setError] = useState('')

  if (!open) return null

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!name.trim()) return
    setSaving(true)
    setError('')
    try {
      await api.createDog(name.trim(), breed, photo || undefined)
      await refreshDogs()
      setName('')
      setBreed('')
      setPhoto(null)
      setAdding(false)
    } catch (err: any) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (dog: DogResponse) => {
    if (!confirm(`Eliminar a ${dog.name}? Se perderán sus clips.`)) return
    setDeleting(dog.id)
    try {
      await api.deleteDog(dog.id)
      await refreshDogs()
    } catch (err: any) {
      setError(err.message)
    } finally {
      setDeleting(null)
    }
  }

  const inputCls = "w-full px-3 py-3 bg-surface border border-border rounded-xl text-text placeholder-text-muted text-sm focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary transition-all"

  return (
    <>
      <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="fixed inset-x-0 bottom-0 z-50 max-h-[85dvh] overflow-y-auto bg-bg-elevated border-t border-border rounded-t-2xl animate-slide-up">
        <div className="max-w-lg mx-auto px-4 py-5 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-extrabold text-text">Mis perros</h2>
            <button onClick={onClose} className="text-text-muted hover:text-text p-1">
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          <div className="space-y-2">
            {dogs.map(dog => (
              <div key={dog.id} className="flex items-center gap-3 p-3 bg-surface border border-border rounded-xl">
                {dog.photo_url ? (
                  <img
                    src={`${import.meta.env.VITE_API_URL ?? ''}${dog.photo_url}`}
                    className="w-10 h-10 rounded-full object-cover border-2 border-border"
                  />
                ) : (
                  <div className="w-10 h-10 rounded-full bg-surface-light flex items-center justify-center text-xl">
                    🐕
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-bold text-text truncate">{dog.name}</p>
                  {dog.breed && <p className="text-[11px] text-text-muted">{dog.breed}</p>}
                </div>
                <button
                  onClick={() => handleDelete(dog)}
                  disabled={deleting === dog.id}
                  className="text-xs text-text-muted hover:text-danger transition-colors px-2 py-1 disabled:opacity-50"
                >
                  {deleting === dog.id ? '...' : 'Eliminar'}
                </button>
              </div>
            ))}
          </div>

          {!adding ? (
            <button
              onClick={() => setAdding(true)}
              className="w-full py-3 rounded-xl border border-dashed border-border text-text-muted text-sm font-medium hover:border-primary/40 hover:text-primary-light active:scale-95 transition-all"
            >
              + Agregar perro
            </button>
          ) : (
            <form onSubmit={handleAdd} className="bg-surface border border-border rounded-2xl p-4 space-y-3">
              <p className="text-xs font-bold text-text-muted uppercase tracking-wider">Nuevo perro</p>

              <input
                type="text"
                placeholder="Nombre"
                value={name}
                onChange={e => setName(e.target.value)}
                className={inputCls}
                autoFocus
                required
              />

              <select
                value={breed}
                onChange={e => setBreed(e.target.value)}
                className={inputCls + ' appearance-none'}
              >
                <option value="">Raza (opcional)</option>
                {BREEDS.map(b => <option key={b} value={b}>{b}</option>)}
                <option value="Otro">Otro</option>
              </select>

              <div className="space-y-2">
                {photo && (
                  <div className="flex items-center gap-3">
                    <img
                      src={URL.createObjectURL(photo)}
                      className="w-12 h-12 rounded-xl object-cover border-2 border-primary/50"
                    />
                    <p className="text-xs text-text-muted flex-1 truncate">{photo.name}</p>
                    <button type="button" onClick={() => setPhoto(null)} className="text-xs text-danger">
                      Quitar
                    </button>
                  </div>
                )}
                <div className="grid grid-cols-2 gap-2">
                  <label className="cursor-pointer">
                    <div className="flex items-center justify-center gap-1.5 py-2.5 rounded-xl border border-border bg-surface-light text-xs font-medium text-text-secondary hover:border-primary/40 active:scale-95 transition-all">
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.409a2.25 2.25 0 013.182 0l2.909 2.909M3.75 21h16.5A2.25 2.25 0 0022.5 18.75V5.25A2.25 2.25 0 0020.25 3H3.75A2.25 2.25 0 001.5 5.25v13.5A2.25 2.25 0 003.75 21z" />
                      </svg>
                      Galeria
                    </div>
                    <input
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={e => setPhoto(e.target.files?.[0] || null)}
                    />
                  </label>
                  <label className="cursor-pointer">
                    <div className="flex items-center justify-center gap-1.5 py-2.5 rounded-xl border border-border bg-surface-light text-xs font-medium text-text-secondary hover:border-primary/40 active:scale-95 transition-all">
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M6.827 6.175A2.31 2.31 0 015.186 7.23c-.38.054-.757.112-1.134.175C2.999 7.58 2.25 8.507 2.25 9.574V18a2.25 2.25 0 002.25 2.25h15A2.25 2.25 0 0021.75 18V9.574c0-1.067-.75-1.994-1.802-2.169a47.865 47.865 0 00-1.134-.175 2.31 2.31 0 01-1.64-1.055l-.822-1.316a2.192 2.192 0 00-1.736-1.039 48.774 48.774 0 00-5.232 0 2.192 2.192 0 00-1.736 1.039l-.821 1.316z" />
                        <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 12.75a4.5 4.5 0 11-9 0 4.5 4.5 0 019 0z" />
                      </svg>
                      Camara
                    </div>
                    <input
                      type="file"
                      accept="image/*"
                      capture="environment"
                      className="hidden"
                      onChange={e => setPhoto(e.target.files?.[0] || null)}
                    />
                  </label>
                </div>
              </div>

              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => { setAdding(false); setName(''); setBreed(''); setPhoto(null) }}
                  className="flex-1 py-2.5 rounded-xl border border-border text-text-muted text-sm font-medium hover:bg-surface-light transition-all"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="flex-1 py-2.5 rounded-xl bg-primary text-white text-sm font-bold shadow-lg shadow-primary/30 hover:brightness-110 active:scale-95 disabled:opacity-50 transition-all"
                >
                  {saving ? 'Guardando...' : 'Agregar'}
                </button>
              </div>
            </form>
          )}

          {error && (
            <div className="p-3 rounded-xl bg-danger/10 border border-danger/30 text-danger text-sm text-center">
              {error}
            </div>
          )}
        </div>
      </div>
    </>
  )
}
