import { useState, useEffect, useCallback } from 'react'
import { useAuth } from '../lib/auth'
import { api, type PlaceResult } from '../lib/api'
import { NeighborhoodInput } from './NeighborhoodInput'

type Category = 'petshop' | 'veterinaria' | 'urgencias'

const CATEGORIES: { key: Category; label: string; icon: string; color: string }[] = [
  { key: 'petshop', label: 'Pet Shops', icon: '🛒', color: 'text-primary-light' },
  { key: 'veterinaria', label: 'Veterinarias', icon: '🏥', color: 'text-success-light' },
  { key: 'urgencias', label: 'Urgencias 24hs', icon: '🚨', color: 'text-danger-light' },
]

export function NearbyPlaces() {
  const { user, refreshUser } = useAuth()
  const [selected, setSelected] = useState<Category>('petshop')
  const [results, setResults] = useState<PlaceResult[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [editingBarrio, setEditingBarrio] = useState(false)
  const [barrio, setBarrio] = useState(user?.neighborhood || '')
  const [saving, setSaving] = useState(false)

  const search = useCallback(async (cat: Category) => {
    if (!user?.neighborhood) return
    setLoading(true)
    setError('')
    try {
      const data = await api.searchPlaces(cat)
      setResults(data.results)
    } catch (err: any) {
      setError(err.message || 'Error al buscar')
      setResults([])
    } finally {
      setLoading(false)
    }
  }, [user?.neighborhood])

  useEffect(() => {
    if (user?.neighborhood) search(selected)
  }, [selected, user?.neighborhood, search])

  const handleSaveBarrio = async () => {
    if (!barrio.trim()) return
    setSaving(true)
    try {
      await api.updateProfile({ neighborhood: barrio.trim() })
      await refreshUser()
      setEditingBarrio(false)
    } catch (err: any) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  if (!user?.neighborhood && !editingBarrio) {
    return (
      <div className="space-y-5">
        <div className="text-center py-10">
          <div className="text-5xl mb-4">📍</div>
          <h3 className="text-lg font-bold text-text mb-2">¿Dónde vivís?</h3>
          <p className="text-sm text-text-muted mb-5 px-4">
            Configurá tu barrio para ver pet shops, veterinarias y urgencias cerca tuyo
          </p>
          <button
            onClick={() => setEditingBarrio(true)}
            className="px-6 py-3 rounded-xl bg-primary text-white font-bold text-sm shadow-lg shadow-primary/30 hover:brightness-110 active:scale-95 transition-all"
          >
            Configurar barrio
          </button>
        </div>
      </div>
    )
  }

  if (editingBarrio) {
    return (
      <div className="space-y-4 py-6">
        <h3 className="text-lg font-bold text-text text-center">Tu barrio</h3>
        <NeighborhoodInput
          value={barrio}
          onChange={setBarrio}
          autoFocus
        />
        <div className="flex gap-2">
          <button
            onClick={() => { setEditingBarrio(false); setBarrio(user?.neighborhood || '') }}
            className="flex-1 py-3 rounded-xl border border-border text-text-muted font-semibold text-sm hover:bg-surface transition-all"
          >
            Cancelar
          </button>
          <button
            onClick={handleSaveBarrio}
            disabled={saving || !barrio.trim()}
            className="flex-1 py-3 rounded-xl bg-primary text-white font-bold text-sm shadow-lg shadow-primary/30 hover:brightness-110 active:scale-95 disabled:opacity-50 transition-all"
          >
            {saving ? 'Guardando...' : 'Guardar'}
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* Barrio header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-lg">📍</span>
          <span className="text-sm font-semibold text-text">{user?.neighborhood}</span>
        </div>
        <button
          onClick={() => { setEditingBarrio(true); setBarrio(user?.neighborhood || '') }}
          className="text-xs text-primary-light font-medium hover:underline"
        >
          Cambiar
        </button>
      </div>

      {/* Category tabs */}
      <div className="flex gap-1 p-1 bg-surface border border-border rounded-2xl">
        {CATEGORIES.map(cat => (
          <button
            key={cat.key}
            onClick={() => setSelected(cat.key)}
            className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-xs font-semibold transition-all ${
              selected === cat.key
                ? 'bg-primary/15 text-primary-light border border-primary/30'
                : 'text-text-muted hover:text-text-secondary'
            }`}
          >
            <span>{cat.icon}</span>
            <span className="hidden min-[360px]:inline">{cat.label}</span>
          </button>
        ))}
      </div>

      {/* Results */}
      {loading ? (
        <div className="flex justify-center py-10">
          <div className="w-8 h-8 border-3 border-primary border-t-transparent rounded-full animate-spin" />
        </div>
      ) : error ? (
        <div className="p-4 rounded-xl bg-danger/10 border border-danger/30 text-danger text-sm text-center">
          {error}
        </div>
      ) : results.length === 0 ? (
        <div className="text-center py-10 text-text-muted">
          <div className="text-4xl mb-3">🔍</div>
          <p className="text-sm font-medium">No se encontraron resultados</p>
          <p className="text-xs mt-1">Probá cambiando el barrio o la categoría</p>
        </div>
      ) : (
        <div className="space-y-2">
          {results.map((place, idx) => (
            <PlaceCard key={`${place.lat}-${place.lon}-${idx}`} place={place} />
          ))}
        </div>
      )}
    </div>
  )
}

function PlaceCard({ place }: { place: PlaceResult }) {
  const fullAddress = [place.address, place.housenumber].filter(Boolean).join(' ')
  const mapsUrl = `https://www.openstreetmap.org/?mlat=${place.lat}&mlon=${place.lon}#map=17/${place.lat}/${place.lon}`

  return (
    <div className="p-4 bg-surface border border-border rounded-xl space-y-2">
      <h4 className="font-bold text-sm text-text">{place.name}</h4>

      {fullAddress && (
        <p className="text-xs text-text-muted flex items-center gap-1.5">
          <svg className="w-3.5 h-3.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 10.5a3 3 0 11-6 0 3 3 0 016 0z" />
            <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1115 0z" />
          </svg>
          {fullAddress}
        </p>
      )}

      {place.phone && (
        <a href={`tel:${place.phone}`} className="text-xs text-primary-light flex items-center gap-1.5 hover:underline">
          <svg className="w-3.5 h-3.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 6.75c0 8.284 6.716 15 15 15h2.25a2.25 2.25 0 002.25-2.25v-1.372c0-.516-.351-.966-.852-1.091l-4.423-1.106c-.44-.11-.902.055-1.173.417l-.97 1.293c-.282.376-.769.542-1.21.38a12.035 12.035 0 01-7.143-7.143c-.162-.441.004-.928.38-1.21l1.293-.97c.363-.271.527-.734.417-1.173L6.963 3.102a1.125 1.125 0 00-1.091-.852H4.5A2.25 2.25 0 002.25 4.5v2.25z" />
          </svg>
          {place.phone}
        </a>
      )}

      {place.opening_hours && (
        <p className="text-xs text-text-muted flex items-center gap-1.5">
          <svg className="w-3.5 h-3.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          {place.opening_hours}
        </p>
      )}

      <div className="flex gap-2 pt-1">
        <a
          href={mapsUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="flex-1 text-center py-2 rounded-lg bg-primary/10 border border-primary/30 text-primary-light text-xs font-semibold hover:bg-primary/20 transition-all"
        >
          Ver en mapa
        </a>
        {place.website && (
          <a
            href={place.website}
            target="_blank"
            rel="noopener noreferrer"
            className="flex-1 text-center py-2 rounded-lg bg-surface border border-border text-text-secondary text-xs font-semibold hover:bg-surface-light transition-all"
          >
            Sitio web
          </a>
        )}
      </div>
    </div>
  )
}
