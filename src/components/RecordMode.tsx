import { useState, useEffect, useRef } from 'react'
import { useRecorder } from '../hooks/useRecorder'
import { useVideoRecorder } from '../hooks/useVideoRecorder'
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

type CaptureMode = 'audio' | 'video' | 'photo'

interface Props {
  selectedDogId: number
  selectedDogName: string
}

export function RecordMode({ selectedDogId, selectedDogName }: Props) {
  const audioRecorder = useRecorder()
  const videoRecorder = useVideoRecorder()
  const videoPreviewRef = useRef<HTMLVideoElement>(null)

  const [captureMode, setCaptureMode] = useState<CaptureMode>('audio')
  const [clips, setClips] = useState<ClipResponse[]>([])
  const [stats, setStats] = useState<ClipStats | null>(null)
  const [pendingBlob, setPendingBlob] = useState<Blob | null>(null)
  const [pendingVideoBlob, setPendingVideoBlob] = useState<Blob | null>(null)
  const [pendingPhotoBlob, setPendingPhotoBlob] = useState<Blob | null>(null)
  const [pendingDuration, setPendingDuration] = useState(0)
  const [saving, setSaving] = useState(false)
  const [cameraActive, setCameraActive] = useState(false)
  const [photoPreviewUrl, setPhotoPreviewUrl] = useState<string | null>(null)
  const [videoPreviewUrl, setVideoPreviewUrl] = useState<string | null>(null)

  useEffect(() => {
    loadData()
  }, [])

  useEffect(() => {
    if ((captureMode === 'video' || captureMode === 'photo') && !cameraActive) {
      activateCamera()
    }
    if (captureMode === 'audio' && cameraActive) {
      deactivateCamera()
    }
    return () => {
      if (captureMode !== 'video' && captureMode !== 'photo') {
        deactivateCamera()
      }
    }
  }, [captureMode])

  const activateCamera = async () => {
    if (!videoPreviewRef.current) return
    await videoRecorder.startPreview(videoPreviewRef.current)
    setCameraActive(true)
  }

  const deactivateCamera = () => {
    videoRecorder.stopPreview()
    setCameraActive(false)
  }

  const loadData = async () => {
    try {
      const [c, s] = await Promise.all([api.getClips(), api.getClipStats()])
      setClips(c)
      setStats(s)
    } catch {}
  }

  const handleAudioStop = async () => {
    const blob = await audioRecorder.stop()
    setPendingBlob(blob)
    setPendingDuration(audioRecorder.duration)
  }

  const handleVideoStart = () => {
    videoRecorder.start()
  }

  const handleVideoStop = async () => {
    const blob = await videoRecorder.stop()
    setPendingVideoBlob(blob)
    setPendingDuration(videoRecorder.duration)
    setVideoPreviewUrl(URL.createObjectURL(blob))
  }

  const handleTakePhoto = () => {
    const blob = videoRecorder.takePhoto()
    if (blob) {
      setPendingPhotoBlob(blob)
      setPhotoPreviewUrl(URL.createObjectURL(blob))
    }
  }

  const handleLabel = async (label: SoundType) => {
    if (!selectedDogId) return
    setSaving(true)
    try {
      if (captureMode === 'audio' && pendingBlob) {
        await api.uploadClip(selectedDogId, label, pendingDuration * 1000, {
          audio: pendingBlob,
          mediaType: 'audio',
        })
      } else if (captureMode === 'video' && pendingVideoBlob) {
        await api.uploadClip(selectedDogId, label, pendingDuration * 1000, {
          video: pendingVideoBlob,
          mediaType: 'video',
        })
      } else if (captureMode === 'photo' && pendingPhotoBlob) {
        await api.uploadClip(selectedDogId, label, 0, {
          photo: pendingPhotoBlob,
          mediaType: 'photo',
        })
      }
      handleDiscard()
      await loadData()
    } catch (err: any) {
      alert(err.message)
    } finally {
      setSaving(false)
    }
  }

  const handleDiscard = () => {
    setPendingBlob(null)
    setPendingVideoBlob(null)
    setPendingPhotoBlob(null)
    setPendingDuration(0)
    if (photoPreviewUrl) URL.revokeObjectURL(photoPreviewUrl)
    if (videoPreviewUrl) URL.revokeObjectURL(videoPreviewUrl)
    setPhotoPreviewUrl(null)
    setVideoPreviewUrl(null)
  }

  const handlePurge = async () => {
    if (!confirm('¿Purgar clips ya procesados? Se libera espacio en disco.')) return
    const res = await api.purgeClips()
    alert(`Purgados: ${res.purged} clips, liberados: ${res.freed_mb} MB`)
    await loadData()
  }

  const hasPending = pendingBlob || pendingVideoBlob || pendingPhotoBlob
  const isRecording = audioRecorder.isRecording || videoRecorder.isRecording

  return (
    <div className="space-y-5">
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

      {/* Capture mode selector */}
      {!hasPending && !isRecording && (
        <div className="flex gap-1 p-1 bg-surface border border-border rounded-xl">
          <button
            onClick={() => setCaptureMode('audio')}
            className={`flex-1 py-2 rounded-lg text-xs font-semibold transition-all flex items-center justify-center gap-1.5 ${
              captureMode === 'audio'
                ? 'bg-primary/15 text-primary-light border border-primary/30'
                : 'text-text-muted hover:text-text-secondary'
            }`}
          >
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 18.75a6 6 0 006-6v-1.5m-6 7.5a6 6 0 01-6-6v-1.5m6 7.5v3.75m-3.75 0h7.5M12 15.75a3 3 0 01-3-3V4.5a3 3 0 116 0v8.25a3 3 0 01-3 3z" />
            </svg>
            Audio
          </button>
          <button
            onClick={() => setCaptureMode('video')}
            className={`flex-1 py-2 rounded-lg text-xs font-semibold transition-all flex items-center justify-center gap-1.5 ${
              captureMode === 'video'
                ? 'bg-accent/15 text-accent-light border border-accent/30'
                : 'text-text-muted hover:text-text-secondary'
            }`}
          >
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="m15.75 10.5 4.72-4.72a.75.75 0 0 1 1.28.53v11.38a.75.75 0 0 1-1.28.53l-4.72-4.72M4.5 18.75h9a2.25 2.25 0 0 0 2.25-2.25v-9a2.25 2.25 0 0 0-2.25-2.25h-9A2.25 2.25 0 0 0 2.25 7.5v9a2.25 2.25 0 0 0 2.25 2.25z" />
            </svg>
            Video
          </button>
          <button
            onClick={() => setCaptureMode('photo')}
            className={`flex-1 py-2 rounded-lg text-xs font-semibold transition-all flex items-center justify-center gap-1.5 ${
              captureMode === 'photo'
                ? 'bg-success/15 text-success-light border border-success/30'
                : 'text-text-muted hover:text-text-secondary'
            }`}
          >
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6.827 6.175A2.31 2.31 0 015.186 7.23c-.38.054-.757.112-1.134.175C2.999 7.58 2.25 8.507 2.25 9.574V18a2.25 2.25 0 002.25 2.25h15A2.25 2.25 0 0021.75 18V9.574c0-1.067-.75-1.994-1.802-2.169a47.865 47.865 0 00-1.134-.175 2.31 2.31 0 01-1.64-1.055l-.822-1.316a2.192 2.192 0 00-1.736-1.039 48.774 48.774 0 00-5.232 0 2.192 2.192 0 00-1.736 1.039l-.821 1.316z" />
              <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 12.75a4.5 4.5 0 11-9 0 4.5 4.5 0 019 0z" />
            </svg>
            Foto
          </button>
        </div>
      )}

      {/* Camera preview (video/photo modes) */}
      <video
        ref={videoPreviewRef}
        autoPlay
        muted
        playsInline
        className={`w-full rounded-2xl border border-border bg-black ${
          (captureMode === 'video' || captureMode === 'photo') && !hasPending ? 'block' : 'hidden'
        }`}
        style={{ maxHeight: 240 }}
      />

      {/* Audio record button */}
      {captureMode === 'audio' && !hasPending && (
        <div className="flex flex-col items-center gap-4 py-6">
          {audioRecorder.isRecording ? (
            <>
              <div className="relative">
                <div className="absolute inset-0 w-24 h-24 rounded-full bg-danger/20 animate-pulse-ring" />
                <button
                  onClick={handleAudioStop}
                  className="relative z-10 w-24 h-24 rounded-full bg-gradient-to-br from-danger to-danger-light flex items-center justify-center shadow-2xl shadow-danger/40"
                >
                  <svg className="w-8 h-8 text-white" fill="currentColor" viewBox="0 0 24 24">
                    <rect x="6" y="6" width="12" height="12" rx="2" />
                  </svg>
                </button>
              </div>
              <div className="text-center">
                <p className="text-lg font-bold text-danger-light font-mono">{formatDuration(audioRecorder.duration)}</p>
                <p className="text-xs text-text-muted mt-1">Grabando audio de {selectedDogName}...</p>
              </div>
              <button onClick={audioRecorder.cancel} className="text-xs text-text-muted hover:text-danger transition-colors">
                Cancelar
              </button>
            </>
          ) : (
            <>
              <button
                onClick={audioRecorder.start}
                className="w-24 h-24 rounded-full bg-gradient-to-br from-danger/80 to-danger flex items-center justify-center shadow-xl shadow-danger/30 hover:scale-105 transition-transform"
              >
                <div className="w-8 h-8 rounded-full bg-white" />
              </button>
              <p className="text-sm text-text-secondary font-medium">
                Grabar audio de {selectedDogName}
              </p>
            </>
          )}
          {audioRecorder.error && <p className="text-sm text-danger">{audioRecorder.error}</p>}
        </div>
      )}

      {/* Video record controls */}
      {captureMode === 'video' && !hasPending && (
        <div className="flex flex-col items-center gap-4 py-4">
          {videoRecorder.isRecording ? (
            <>
              <div className="flex items-center gap-4">
                <button
                  onClick={handleVideoStop}
                  className="w-16 h-16 rounded-full bg-gradient-to-br from-danger to-danger-light flex items-center justify-center shadow-xl shadow-danger/40 animate-pulse"
                >
                  <svg className="w-6 h-6 text-white" fill="currentColor" viewBox="0 0 24 24">
                    <rect x="6" y="6" width="12" height="12" rx="2" />
                  </svg>
                </button>
              </div>
              <p className="text-lg font-bold text-danger-light font-mono">{formatDuration(videoRecorder.duration)}</p>
              <p className="text-xs text-text-muted">Grabando video de {selectedDogName}...</p>
              <button onClick={() => { videoRecorder.cancel() }} className="text-xs text-text-muted hover:text-danger transition-colors">
                Cancelar
              </button>
            </>
          ) : (
            <>
              <button
                onClick={handleVideoStart}
                className="w-16 h-16 rounded-full bg-gradient-to-br from-accent/80 to-accent flex items-center justify-center shadow-xl shadow-accent/30 hover:scale-105 transition-transform"
              >
                <div className="w-6 h-6 rounded-full bg-white" />
              </button>
              <p className="text-sm text-text-secondary font-medium">
                Grabar video de {selectedDogName}
              </p>
            </>
          )}
          {videoRecorder.error && <p className="text-sm text-danger">{videoRecorder.error}</p>}
        </div>
      )}

      {/* Photo capture controls */}
      {captureMode === 'photo' && !hasPending && (
        <div className="flex flex-col items-center gap-4 py-4">
          <button
            onClick={handleTakePhoto}
            className="w-16 h-16 rounded-full bg-gradient-to-br from-success/80 to-success flex items-center justify-center shadow-xl shadow-success/30 hover:scale-105 transition-transform border-4 border-white/20"
          >
            <svg className="w-7 h-7 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6.827 6.175A2.31 2.31 0 015.186 7.23c-.38.054-.757.112-1.134.175C2.999 7.58 2.25 8.507 2.25 9.574V18a2.25 2.25 0 002.25 2.25h15A2.25 2.25 0 0021.75 18V9.574c0-1.067-.75-1.994-1.802-2.169a47.865 47.865 0 00-1.134-.175 2.31 2.31 0 01-1.64-1.055l-.822-1.316a2.192 2.192 0 00-1.736-1.039 48.774 48.774 0 00-5.232 0 2.192 2.192 0 00-1.736 1.039l-.821 1.316z" />
              <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 12.75a4.5 4.5 0 11-9 0 4.5 4.5 0 019 0z" />
            </svg>
          </button>
          <p className="text-sm text-text-secondary font-medium">
            Tomar foto de {selectedDogName}
          </p>
          {videoRecorder.error && <p className="text-sm text-danger">{videoRecorder.error}</p>}
        </div>
      )}

      {/* Labeling step */}
      {hasPending && (
        <div className="animate-slide-up bg-surface border border-primary/30 rounded-2xl p-5 space-y-4">
          <div className="text-center">
            <p className="text-sm font-bold text-text">¿Qué sonido grabaste?</p>
            <p className="text-xs text-text-muted mt-1">
              {captureMode === 'photo' ? 'Foto' : `Clip de ${pendingDuration}s`} para {selectedDogName}
            </p>
          </div>

          {/* Audio preview */}
          {pendingBlob && (
            <audio
              controls
              src={URL.createObjectURL(pendingBlob)}
              className="w-full h-10 rounded-lg"
            />
          )}

          {/* Video preview */}
          {videoPreviewUrl && (
            <video
              controls
              src={videoPreviewUrl}
              className="w-full rounded-xl border border-border"
              style={{ maxHeight: 200 }}
            />
          )}

          {/* Photo preview */}
          {photoPreviewUrl && (
            <img
              src={photoPreviewUrl}
              className="w-full rounded-xl border border-border object-cover"
              style={{ maxHeight: 200 }}
            />
          )}

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
            Descartar
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
                    {clip.has_video && ' 🎬'}
                    {clip.has_photo && ' 📷'}
                  </p>
                  <p className="text-[10px] text-text-muted">
                    {clip.media_type} · {Math.round(clip.duration_ms / 1000)}s · {new Date(clip.created_at).toLocaleString('es-AR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}
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
