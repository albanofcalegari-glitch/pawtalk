import { useState, useEffect } from 'react'
import { useRecorder } from '../hooks/useRecorder'
import { useAuth } from '../lib/auth'
import { api, type ClipResponse, type ClipStats } from '../lib/api'
import type { SoundType } from '../lib/audioClassifier'
import { getLabel } from '../lib/audioClassifier'

const LABELS: SoundType[] = ['bark', 'whine', 'growl', 'howl', 'pant']

const LABEL_EMOJI: Record<SoundType, string> = {
  bark: '🐕',
  whine: '🥺',
  growl: '😤',
  howl: '🌙',
  pant: '😮‍💨',
  silence: '😴',
}

export function RecordMode() {
  const { dogs } = useAuth()
  const { isRecording, duration, error, start, stop, cancel } = useRecorder()
  const [selectedDogId, setSelectedDogId] = useState<number | null>(null)
  const [clips, setClips] = useState<ClipResponse[]>([])
  const [stats, setStats] = useState<ClipStats | null>(null)
  const [pendingBlob, setPendingBlob] = useState<Blob | null>(null)
  const [pendingDuration, setPendingDuration] = useState(0)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (dogs.length > 0 && !selectedDogId) setSelectedDogId(dogs[0].id)
  }, [dogs, selectedDogId])

  useEffect(() => {
    loadData()
  }, [])

  const loadData = async () => {
    try {
      const [c, s] = await Promise.all([api.getClips(), api.getClipStats()])
      setClips(c)
      setStats(s)
    } catch {}
  }

  const handleStop = async () => {
    const blob = await stop()
    setPendingBlob(blob)
    setPendingDuration(duration)
  }

  const handleLabel = async (label: SoundType) => {
    if (!pendingBlob || !selectedDogId) return
    setSaving(true)
    try {
      await api.uploadClip(selectedDogId, label, pendingDuration * 1000, pendingBlob)
      setPendingBlob(null)
      setPendingDuration(0)
      await loadData()
    } catch (err: any) {
      alert(err.message)
    } finally {
      setSaving(false)
    }
  }

  const handleDiscard = () => {
    setPendingBlob(null)
    setPendingDuration(0)
  }

  const handlePurge = async () => {
    if (!confirm('¿Purgar clips ya procesados? Se libera espacio en disco.')) return
    const res = await api.purgeClips()
    alert(`Purgados: ${res.purged} clips, liberados: ${res.freed_mb} MB`)
    await loadData()
  }

  const selectedDog = dogs.find(d => d.id === selectedDogId)

  return (
    <div className="space-y-5">
      {/* Dog picker for recording */}
      {dogs.length > 1 && (
        <div className="flex gap-2">
          {dogs.map(dog => (
            <button
              key={dog.id}
              onClick={() => setSelectedDogId(dog.id)}
              className={`flex-1 py-2 rounded-xl text-sm font-medium border transition-all ${
                selectedDogId === dog.id
                  ? 'border-danger/50 bg-danger/10 text-danger-light'
                  : 'border-border bg-surface text-text-muted'
              }`}
            >
              {dog.name}
            </button>
          ))}
        </div>
      )}

      {/* Stats */}
      {stats && (
        <div className="grid grid-cols-3 gap-2">
          <div className="bg-surface border border-border rounded-xl p-3 text-center">
            <p className="text-xl font-bold text-primary-light">{stats.total}</p>
            <p className="text-[10px] text-text-muted font-medium">Clips</p>
          </div>
          <div className="bg-surface border border-border rounded-xl p-3 text-center">
            <p className="text-xl font-bold text-accent-light">{stats.pending}</p>
            <p className="text-[10px] text-text-muted font-medium">Pendientes</p>
          </div>
          <div className="bg-surface border border-border rounded-xl p-3 text-center">
            <p className="text-xl font-bold text-success-light">{stats.disk_mb}</p>
            <p className="text-[10px] text-text-muted font-medium">MB</p>
          </div>
        </div>
      )}

      {/* Label distribution */}
      {stats && stats.total > 0 && (
        <div className="flex flex-wrap gap-2">
          {Object.entries(stats.by_label).map(([label, count]) => (
            <span key={label} className="text-[11px] px-2.5 py-1 rounded-full bg-surface-light border border-border text-text-secondary font-medium">
              {LABEL_EMOJI[label as SoundType]} {getLabel(label as SoundType)}: {count}
            </span>
          ))}
        </div>
      )}

      {/* Record button */}
      {!pendingBlob && (
        <div className="flex flex-col items-center gap-4 py-6">
          {isRecording ? (
            <>
              <div className="relative">
                <div className="absolute inset-0 w-24 h-24 rounded-full bg-danger/20 animate-pulse-ring" />
                <button
                  onClick={handleStop}
                  className="relative z-10 w-24 h-24 rounded-full bg-gradient-to-br from-danger to-danger-light flex items-center justify-center shadow-2xl shadow-danger/40"
                >
                  <svg className="w-8 h-8 text-white" fill="currentColor" viewBox="0 0 24 24">
                    <rect x="6" y="6" width="12" height="12" rx="2" />
                  </svg>
                </button>
              </div>
              <div className="text-center">
                <p className="text-lg font-bold text-danger-light font-mono">{formatDuration(duration)}</p>
                <p className="text-xs text-text-muted mt-1">Grabando para {selectedDog?.name}...</p>
              </div>
              <button onClick={cancel} className="text-xs text-text-muted hover:text-danger transition-colors">
                Cancelar
              </button>
            </>
          ) : (
            <>
              <button
                onClick={start}
                className="w-24 h-24 rounded-full bg-gradient-to-br from-danger/80 to-danger flex items-center justify-center shadow-xl shadow-danger/30 hover:scale-105 transition-transform"
              >
                <div className="w-8 h-8 rounded-full bg-white" />
              </button>
              <p className="text-sm text-text-secondary font-medium">
                Grabar clip de {selectedDog?.name || '...'}
              </p>
            </>
          )}

          {error && <p className="text-sm text-danger">{error}</p>}
        </div>
      )}

      {/* Labeling step */}
      {pendingBlob && (
        <div className="animate-slide-up bg-surface border border-primary/30 rounded-2xl p-5 space-y-4">
          <div className="text-center">
            <p className="text-sm font-bold text-text">¿Qué sonido grabaste?</p>
            <p className="text-xs text-text-muted mt-1">
              Clip de {pendingDuration}s para {selectedDog?.name}
            </p>
          </div>

          <audio
            controls
            src={URL.createObjectURL(pendingBlob)}
            className="w-full h-10 rounded-lg"
          />

          <div className="grid grid-cols-3 gap-2">
            {LABELS.map(label => (
              <button
                key={label}
                onClick={() => handleLabel(label)}
                disabled={saving}
                className="py-3 rounded-xl border border-border bg-surface-light hover:bg-surface-hover hover:border-primary/40 text-text-secondary text-sm font-medium transition-all disabled:opacity-50"
              >
                {LABEL_EMOJI[label]} {getLabel(label)}
              </button>
            ))}
          </div>

          <button
            onClick={handleDiscard}
            className="w-full py-2 text-xs text-text-muted hover:text-danger transition-colors font-medium"
          >
            Descartar clip
          </button>
        </div>
      )}

      {/* Recent clips */}
      {clips.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center justify-between px-1">
            <h3 className="text-xs font-bold text-text-muted uppercase tracking-widest">
              Últimos clips
            </h3>
            {stats && stats.processed > 0 && (
              <button onClick={handlePurge} className="text-[11px] text-text-muted hover:text-danger font-medium transition-colors">
                Purgar procesados
              </button>
            )}
          </div>

          <div className="space-y-2 max-h-52 overflow-y-auto">
            {clips.slice(0, 15).map(clip => (
              <div key={clip.id} className="flex items-center gap-3 bg-surface border border-border/50 rounded-xl px-3 py-2.5">
                <span className="text-lg">{LABEL_EMOJI[clip.label as SoundType] || '❓'}</span>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium text-text truncate">
                    {getLabel(clip.label as SoundType)} · {clip.dog_name}
                  </p>
                  <p className="text-[10px] text-text-muted">
                    {Math.round(clip.duration_ms / 1000)}s · {new Date(clip.created_at).toLocaleString('es-AR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}
                  </p>
                </div>
                {clip.processed && (
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-success/15 text-success-light font-medium">ML</span>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

function formatDuration(seconds: number): string {
  const m = Math.floor(seconds / 60)
  const s = seconds % 60
  return `${m}:${s.toString().padStart(2, '0')}`
}
