import { useState, useEffect } from 'react'

interface Stats {
  total_users: number
  total_dogs: number
  total_clips: number
  processed: number
  pending: number
  by_label: Record<string, number>
  by_media: Record<string, number>
}

interface DogInfo {
  id: number
  name: string
  breed: string
  photo_url: string | null
  clip_count: number
}

interface UserInfo {
  id: number
  email: string
  name: string
  created_at: string
  dog_count: number
  clip_count: number
  dogs: DogInfo[]
}

interface Props {
  token: string
  onLogout: () => void
}

const API = import.meta.env.VITE_API_URL ?? ''

const LABEL_EMOJI: Record<string, string> = {
  bark: '🗣️',
  whine: '😢',
  growl: '😠',
  howl: '🌙',
  pant: '😮‍💨',
  silence: '🤫',
  other: '❓',
}

const MEDIA_EMOJI: Record<string, string> = {
  audio: '🎙️',
  video: '🎬',
  photo: '📸',
}

export function AdminDashboard({ token, onLogout }: Props) {
  const [stats, setStats] = useState<Stats | null>(null)
  const [users, setUsers] = useState<UserInfo[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [expandedUser, setExpandedUser] = useState<number | null>(null)

  useEffect(() => {
    const headers = { Authorization: `Bearer ${token}` }
    Promise.all([
      fetch(`${API}/api/admin/stats`, { headers }).then(r => {
        if (!r.ok) throw new Error('No autorizado')
        return r.json()
      }),
      fetch(`${API}/api/admin/users`, { headers }).then(r => {
        if (!r.ok) throw new Error('No autorizado')
        return r.json()
      }),
    ])
      .then(([s, u]) => { setStats(s); setUsers(u) })
      .catch(err => {
        setError(err.message)
        if (err.message === 'No autorizado') onLogout()
      })
      .finally(() => setLoading(false))
  }, [token, onLogout])

  if (loading) {
    return (
      <div className="min-h-dvh flex items-center justify-center bg-bg">
        <div className="flex flex-col items-center gap-3">
          <div className="w-10 h-10 border-3 border-primary border-t-transparent rounded-full animate-spin" />
          <p className="text-sm text-text-muted">Cargando panel...</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="min-h-dvh flex items-center justify-center bg-bg px-4">
        <div className="p-4 rounded-xl bg-danger/10 border border-danger/30 text-danger text-sm text-center">
          {error}
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-dvh bg-bg">
      {/* Header */}
      <header className="sticky top-0 z-20 bg-bg/80 backdrop-blur-xl border-b border-border/50 px-4 py-3">
        <div className="max-w-3xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-2xl">🐾</span>
            <h1 className="text-lg font-extrabold text-text">PawTalk Admin</h1>
          </div>
          <button
            onClick={onLogout}
            className="text-xs text-text-muted hover:text-danger transition-colors font-medium px-3 py-1.5 rounded-lg hover:bg-danger/10"
          >
            Cerrar sesion
          </button>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 py-6 space-y-6">
        {/* Stats cards */}
        {stats && (
          <>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <StatCard label="Usuarios" value={stats.total_users} icon="👤" />
              <StatCard label="Mascotas" value={stats.total_dogs} icon="🐕" />
              <StatCard label="Clips" value={stats.total_clips} icon="🎤" />
              <StatCard label="Procesados" value={stats.processed} icon="✅" sub={stats.pending > 0 ? `${stats.pending} pendientes` : undefined} />
            </div>

            {/* By label */}
            {Object.keys(stats.by_label).length > 0 && (
              <section className="space-y-2">
                <h2 className="text-xs font-bold text-text-muted uppercase tracking-widest px-1">Por etiqueta</h2>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {Object.entries(stats.by_label)
                    .sort((a, b) => b[1] - a[1])
                    .map(([label, count]) => (
                      <div key={label} className="flex items-center gap-2 p-3 rounded-xl bg-surface border border-border">
                        <span className="text-lg">{LABEL_EMOJI[label] || '🏷️'}</span>
                        <div>
                          <p className="text-sm font-bold text-text capitalize">{label}</p>
                          <p className="text-xs text-text-muted">{count} clips</p>
                        </div>
                      </div>
                    ))}
                </div>
              </section>
            )}

            {/* By media */}
            {Object.keys(stats.by_media).length > 0 && (
              <section className="space-y-2">
                <h2 className="text-xs font-bold text-text-muted uppercase tracking-widest px-1">Por tipo de medio</h2>
                <div className="grid grid-cols-3 gap-2">
                  {Object.entries(stats.by_media)
                    .sort((a, b) => b[1] - a[1])
                    .map(([media, count]) => (
                      <div key={media} className="flex items-center gap-2 p-3 rounded-xl bg-surface border border-border">
                        <span className="text-lg">{MEDIA_EMOJI[media] || '📁'}</span>
                        <div>
                          <p className="text-sm font-bold text-text capitalize">{media}</p>
                          <p className="text-xs text-text-muted">{count}</p>
                        </div>
                      </div>
                    ))}
                </div>
              </section>
            )}
          </>
        )}

        {/* Users table */}
        <section className="space-y-2">
          <h2 className="text-xs font-bold text-text-muted uppercase tracking-widest px-1">
            Usuarios ({users.length})
          </h2>

          {users.length === 0 ? (
            <div className="p-8 rounded-xl bg-surface border border-border text-center">
              <p className="text-text-muted text-sm">No hay usuarios registrados</p>
            </div>
          ) : (
            <div className="space-y-2">
              {users.map(u => (
                <div key={u.id} className="rounded-xl bg-surface border border-border overflow-hidden">
                  <button
                    onClick={() => setExpandedUser(expandedUser === u.id ? null : u.id)}
                    className="w-full flex items-center justify-between p-4 text-left hover:bg-surface-light transition-colors"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-10 h-10 rounded-full bg-primary/15 flex items-center justify-center text-lg shrink-0">
                        👤
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-bold text-text truncate">{u.name}</p>
                        <p className="text-xs text-text-muted truncate">{u.email}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3 shrink-0">
                      <div className="text-right">
                        <p className="text-xs text-text-muted">
                          {u.dog_count} {u.dog_count === 1 ? 'mascota' : 'mascotas'} · {u.clip_count} clips
                        </p>
                        <p className="text-[10px] text-text-muted/60">
                          {new Date(u.created_at).toLocaleDateString('es-AR')}
                        </p>
                      </div>
                      <svg
                        className={`w-4 h-4 text-text-muted transition-transform ${expandedUser === u.id ? 'rotate-180' : ''}`}
                        fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}
                      >
                        <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
                      </svg>
                    </div>
                  </button>

                  {expandedUser === u.id && u.dogs.length > 0 && (
                    <div className="border-t border-border bg-bg-elevated px-4 py-3 space-y-2">
                      {u.dogs.map(d => (
                        <div key={d.id} className="flex items-center gap-3 p-2 rounded-lg bg-surface/50">
                          {d.photo_url ? (
                            <img
                              src={`${API}${d.photo_url}`}
                              className="w-9 h-9 rounded-full object-cover border border-border"
                            />
                          ) : (
                            <div className="w-9 h-9 rounded-full bg-surface-light flex items-center justify-center text-lg">
                              🐕
                            </div>
                          )}
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-semibold text-text">{d.name}</p>
                            <p className="text-xs text-text-muted">{d.breed}</p>
                          </div>
                          <span className="text-xs text-text-muted bg-surface px-2 py-1 rounded-lg">
                            {d.clip_count} clips
                          </span>
                        </div>
                      ))}
                    </div>
                  )}

                  {expandedUser === u.id && u.dogs.length === 0 && (
                    <div className="border-t border-border bg-bg-elevated px-4 py-3">
                      <p className="text-xs text-text-muted text-center">Sin mascotas registradas</p>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </section>
      </main>
    </div>
  )
}

function StatCard({ label, value, icon, sub }: { label: string; value: number; icon: string; sub?: string }) {
  return (
    <div className="p-4 rounded-xl bg-surface border border-border space-y-1">
      <div className="flex items-center justify-between">
        <span className="text-lg">{icon}</span>
      </div>
      <p className="text-2xl font-extrabold text-text">{value}</p>
      <p className="text-xs text-text-muted">{label}</p>
      {sub && <p className="text-[10px] text-accent">{sub}</p>}
    </div>
  )
}
