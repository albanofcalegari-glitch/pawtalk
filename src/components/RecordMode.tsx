import { useState, useEffect, useRef } from 'react'
import { useRecorder } from '../hooks/useRecorder'
import { useVideoRecorder } from '../hooks/useVideoRecorder'
import { api, type ClipResponse, type ClipStats } from '../lib/api'
import type { SoundType } from '../lib/audioClassifier'
import { getLabel } from '../lib/audioClassifier'

const SOUND_LABELS: SoundType[] = ['bark', 'whine', 'growl', 'howl', 'pant']
const BEHAVIOR_LABELS: SoundType[] = ['lying', 'sitting', 'playing', 'eating', 'sleeping', 'alert', 'relaxed', 'walking']

const LABEL_EMOJI: Record<string, string> = {
  bark: '🐕',
  whine: '🥺',
  growl: '😤',
  howl: '🌙',
  pant: '😮‍💨',
  silence: '😴',
  lying: '🛌',
  sitting: '🐕‍🦺',
  playing: '🎾',
  eating: '🍖',
  sleeping: '💤',
  alert: '👀',
  relaxed: '😌',
  walking: '🚶',
  other: '📎',
}

const MAX_FILE_MB: Record<string, number> = { video: 150, audio: 30, photo: 15 }

function formatMB(bytes: number): string {
  const mb = bytes / (1024 * 1024)
  return mb >= 1 ? `${mb.toFixed(1)} MB` : `${(bytes / 1024).toFixed(0)} KB`
}

type CaptureMode = 'audio' | 'video' | 'photo'
type TopTab = 'capture' | 'history'

interface Props {
  selectedDogId: number
  selectedDogName: string
}

export function RecordMode({ selectedDogId, selectedDogName }: Props) {
  const audioRecorder = useRecorder()
  const videoRecorder = useVideoRecorder()
  const videoPreviewRef = useRef<HTMLVideoElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const [topTab, setTopTab] = useState<TopTab>('capture')
  const [captureMode, setCaptureMode] = useState<CaptureMode>('audio')
  const [clips, setClips] = useState<ClipResponse[]>([])
  const [stats, setStats] = useState<ClipStats | null>(null)
  const [pendingBlob, setPendingBlob] = useState<Blob | null>(null)
  const [pendingVideoBlob, setPendingVideoBlob] = useState<Blob | null>(null)
  const [pendingPhotoBlob, setPendingPhotoBlob] = useState<Blob | null>(null)
  const [pendingDuration, setPendingDuration] = useState(0)
  const [confirmed, setConfirmed] = useState(false)
  const [saving, setSaving] = useState(false)
  const [uploadProgress, setUploadProgress] = useState(0)
  const [selectedLabel, setSelectedLabel] = useState<SoundType | null>(null)
  const [cameraActive, setCameraActive] = useState(false)
  const [photoPreviewUrl, setPhotoPreviewUrl] = useState<string | null>(null)
  const [videoPreviewUrl, setVideoPreviewUrl] = useState<string | null>(null)
  const [uploadedFromGallery, setUploadedFromGallery] = useState(false)
  const [uploadedFileName, setUploadedFileName] = useState<string | null>(null)
  const [sizeError, setSizeError] = useState<string | null>(null)
  const [successMsg, setSuccessMsg] = useState<string | null>(null)

  useEffect(() => {
    loadData()
  }, [])

  useEffect(() => {
    if (topTab !== 'capture') return
    if ((captureMode === 'video' || captureMode === 'photo') && !cameraActive && !hasPending && !uploadedFromGallery) {
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
  }, [captureMode, topTab])

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

  const checkSize = (blob: Blob, mode: CaptureMode): boolean => {
    const maxBytes = MAX_FILE_MB[mode] * 1024 * 1024
    if (blob.size > maxBytes) {
      setSizeError(`El archivo pesa ${formatMB(blob.size)} y el máximo para ${mode === 'video' ? 'video' : mode === 'audio' ? 'audio' : 'foto'} es ${MAX_FILE_MB[mode]} MB. Recortalo o comprimilo antes de subirlo.`)
      return false
    }
    setSizeError(null)
    return true
  }

  const handleAudioStop = async () => {
    const dur = audioRecorder.duration
    const blob = await audioRecorder.stop()
    checkSize(blob, 'audio')
    setPendingBlob(blob)
    setPendingDuration(dur)
  }

  const handleVideoStart = () => {
    videoRecorder.start()
  }

  const handleVideoStop = async () => {
    const dur = videoRecorder.duration
    const blob = await videoRecorder.stop()
    checkSize(blob, 'video')
    setPendingVideoBlob(blob)
    setPendingDuration(dur)
    setVideoPreviewUrl(URL.createObjectURL(blob))
  }

  const handleTakePhoto = () => {
    const blob = videoRecorder.takePhoto()
    if (blob) {
      checkSize(blob, 'photo')
      setPendingPhotoBlob(blob)
      setPhotoPreviewUrl(URL.createObjectURL(blob))
    }
  }

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    e.target.value = ''

    const mime = file.type
    const blob = file as Blob
    const url = URL.createObjectURL(blob)
    let mode: CaptureMode = 'audio'

    if (mime.startsWith('image/')) {
      mode = 'photo'
      setCaptureMode('photo')
      setPendingPhotoBlob(blob)
      setPhotoPreviewUrl(url)
    } else if (mime.startsWith('video/')) {
      mode = 'video'
      setCaptureMode('video')
      setPendingVideoBlob(blob)
      setVideoPreviewUrl(url)
      const vid = document.createElement('video')
      vid.preload = 'metadata'
      vid.onloadedmetadata = () => {
        setPendingDuration(Math.round(vid.duration))
        URL.revokeObjectURL(vid.src)
      }
      vid.src = URL.createObjectURL(blob)
    } else if (mime.startsWith('audio/')) {
      mode = 'audio'
      setCaptureMode('audio')
      setPendingBlob(blob)
      const aud = document.createElement('audio')
      aud.preload = 'metadata'
      aud.onloadedmetadata = () => {
        setPendingDuration(Math.round(aud.duration))
        URL.revokeObjectURL(aud.src)
      }
      aud.src = URL.createObjectURL(blob)
    }
    checkSize(blob, mode)
    setUploadedFromGallery(true)
    setUploadedFileName(file.name)
    deactivateCamera()
  }

  const handleConfirm = () => {
    setConfirmed(true)
  }

  const handleSend = async () => {
    if (!selectedDogId || !selectedLabel) return
    setSaving(true)
    setUploadProgress(0)
    const onProgress = (pct: number) => setUploadProgress(pct)
    try {
      const fn = uploadedFileName || undefined
      if (captureMode === 'audio' && pendingBlob) {
        await api.uploadClip(selectedDogId, selectedLabel, pendingDuration * 1000, {
          audio: pendingBlob,
          mediaType: 'audio',
          fileName: fn,
          onProgress,
        })
      } else if (captureMode === 'video' && pendingVideoBlob) {
        await api.uploadClip(selectedDogId, selectedLabel, pendingDuration * 1000, {
          video: pendingVideoBlob,
          mediaType: 'video',
          fileName: fn,
          onProgress,
        })
      } else if (captureMode === 'photo' && pendingPhotoBlob) {
        await api.uploadClip(selectedDogId, selectedLabel, 0, {
          photo: pendingPhotoBlob,
          mediaType: 'photo',
          fileName: fn,
          onProgress,
        })
      }
      const label = captureMode === 'photo' ? 'Foto' : captureMode === 'video' ? 'Video' : 'Audio'
      handleDiscard()
      setSuccessMsg(`${label} de ${selectedDogName} subido correctamente`)
      setTimeout(() => setSuccessMsg(null), 4000)
      await loadData()
    } catch (err: any) {
      alert(err.message)
    } finally {
      setSaving(false)
      setUploadProgress(0)
    }
  }

  const handleDiscard = () => {
    setPendingBlob(null)
    setPendingVideoBlob(null)
    setPendingPhotoBlob(null)
    setPendingDuration(0)
    setConfirmed(false)
    setSelectedLabel(null)
    if (photoPreviewUrl) URL.revokeObjectURL(photoPreviewUrl)
    if (videoPreviewUrl) URL.revokeObjectURL(videoPreviewUrl)
    setPhotoPreviewUrl(null)
    setVideoPreviewUrl(null)
    setUploadedFromGallery(false)
    setUploadedFileName(null)
    setSizeError(null)
  }

  const handlePurge = async () => {
    if (!confirm('¿Purgar clips ya procesados? Se libera espacio en disco.')) return
    const res = await api.purgeClips()
    alert(`Purgados: ${res.purged} clips, liberados: ${res.freed_mb} MB`)
    await loadData()
  }

  const hasPending = !!(pendingBlob || pendingVideoBlob || pendingPhotoBlob)
  const isRecording = audioRecorder.isRecording || videoRecorder.isRecording

  return (
    <div className="space-y-4">
      {/* Stats row */}
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

      {/* Top tabs: Grabar / Historial */}
      <div className="flex gap-1 p-1 bg-surface border border-border rounded-xl">
        <button
          onClick={() => setTopTab('capture')}
          className={`flex-1 py-2 rounded-lg text-xs font-semibold transition-all flex items-center justify-center gap-1.5 ${
            topTab === 'capture'
              ? 'bg-primary/15 text-primary-light border border-primary/30'
              : 'text-text-muted hover:text-text-secondary'
          }`}
        >
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <circle cx="12" cy="12" r="10" />
            <circle cx="12" cy="12" r="4" fill="currentColor" />
          </svg>
          Grabar
        </button>
        <button
          onClick={() => setTopTab('history')}
          className={`flex-1 py-2 rounded-lg text-xs font-semibold transition-all flex items-center justify-center gap-1.5 ${
            topTab === 'history'
              ? 'bg-primary/15 text-primary-light border border-primary/30'
              : 'text-text-muted hover:text-text-secondary'
          }`}
        >
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 12h16.5m-16.5 3.75h16.5M3.75 19.5h16.5M5.625 4.5h12.75a1.875 1.875 0 010 3.75H5.625a1.875 1.875 0 010-3.75z" />
          </svg>
          Historial {clips.length > 0 && `(${clips.length})`}
        </button>
      </div>

      {/* Success toast */}
      {successMsg && (
        <div className="animate-slide-up flex items-center gap-2.5 p-3 rounded-xl bg-success/10 border border-success/30">
          <div className="w-7 h-7 rounded-full bg-success/20 flex items-center justify-center shrink-0">
            <svg className="w-4 h-4 text-success-light" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
            </svg>
          </div>
          <p className="text-success-light text-sm font-medium">{successMsg}</p>
        </div>
      )}

      {/* ===== CAPTURE TAB ===== */}
      {topTab === 'capture' && (
        <div className="space-y-4">
          {/* Capture mode selector */}
          {!hasPending && !isRecording && (
            <div className="flex gap-1 p-1 bg-surface-light border border-border/50 rounded-xl">
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

          {/* Upload from gallery */}
          {!hasPending && !isRecording && (
            <>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*,video/*,audio/*"
                className="hidden"
                onChange={handleFileUpload}
              />
              <button
                onClick={() => fileInputRef.current?.click()}
                className="w-full py-2.5 rounded-xl border border-dashed border-primary/40 text-primary-light text-xs font-semibold hover:bg-primary/5 active:scale-[0.98] transition-all flex items-center justify-center gap-2"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" />
                </svg>
                Subir desde galería
              </button>
            </>
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

          {/* ── STEP 1: Preview + Confirm/Discard ── */}
          {hasPending && !confirmed && (
            <div className="animate-slide-up bg-surface border border-border rounded-2xl p-5 space-y-4">
              <p className="text-center text-sm font-bold text-text">
                {uploadedFromGallery
                  ? captureMode === 'photo' ? '📷 Foto subida' : captureMode === 'video' ? '🎬 Video subido' : '🎙️ Audio subido'
                  : captureMode === 'photo' ? '📷 Foto capturada' : captureMode === 'video' ? '🎬 Video grabado' : '🎙️ Audio grabado'}
              </p>

              {pendingBlob && (
                <audio controls src={URL.createObjectURL(pendingBlob)} className="w-full h-10 rounded-lg" />
              )}
              {videoPreviewUrl && (
                <video controls src={videoPreviewUrl} className="w-full rounded-xl border border-border" style={{ maxHeight: 200 }} />
              )}
              {photoPreviewUrl && (
                <img src={photoPreviewUrl} className="w-full rounded-xl border border-border object-cover" style={{ maxHeight: 200 }} />
              )}

              <p className="text-center text-xs text-text-muted">
                {captureMode === 'photo' ? 'Foto' : `${pendingDuration}s`} · {selectedDogName} · {formatMB((pendingBlob || pendingVideoBlob || pendingPhotoBlob)?.size || 0)}
              </p>

              {sizeError && (
                <div className="p-3 rounded-xl bg-danger/10 border border-danger/30 space-y-1">
                  <p className="text-danger text-xs font-bold">Archivo demasiado grande</p>
                  <p className="text-danger/80 text-[11px] leading-snug">{sizeError}</p>
                </div>
              )}

              <div className="flex gap-3">
                <button
                  onClick={handleDiscard}
                  className="flex-1 py-3 rounded-xl border-2 border-danger/40 text-danger font-bold text-sm hover:bg-danger/10 active:scale-95 transition-all"
                >
                  Descartar
                </button>
                <button
                  onClick={handleConfirm}
                  disabled={!!sizeError}
                  className="flex-1 py-3 rounded-xl bg-primary text-white font-bold text-sm shadow-lg shadow-primary/30 hover:brightness-110 active:scale-95 disabled:opacity-40 transition-all"
                >
                  Confirmar
                </button>
              </div>
            </div>
          )}

          {/* ── STEP 2: Label + Send ── */}
          {hasPending && confirmed && (
            <div className="animate-slide-up bg-surface border border-primary/30 rounded-2xl p-5 space-y-4">
              <div className="text-center">
                <p className="text-sm font-bold text-text">
                  {captureMode === 'audio' ? '¿Qué sonido es?' : captureMode === 'photo' ? '¿Qué está haciendo?' : 'Clasificá el clip'}
                </p>
                <p className="text-xs text-text-muted mt-1">Elegí una etiqueta para {selectedDogName}</p>
              </div>

              {(captureMode === 'audio' || captureMode === 'video') && (
                <>
                  <p className="text-[11px] font-semibold text-text-muted uppercase tracking-wider">Sonidos</p>
                  <div className="grid grid-cols-3 gap-2">
                    {SOUND_LABELS.map(label => (
                      <button
                        key={label}
                        onClick={() => setSelectedLabel(label)}
                        className={`py-2.5 rounded-xl border text-sm font-medium transition-all ${
                          selectedLabel === label
                            ? 'border-primary bg-primary/15 text-primary-light scale-[1.03]'
                            : 'border-border bg-surface-light text-text-secondary hover:border-primary/40'
                        }`}
                      >
                        {LABEL_EMOJI[label]} {getLabel(label)}
                      </button>
                    ))}
                  </div>
                </>
              )}

              {(captureMode === 'photo' || captureMode === 'video') && (
                <>
                  <p className="text-[11px] font-semibold text-text-muted uppercase tracking-wider">
                    {captureMode === 'video' ? 'Comportamiento' : 'Postura / estado'}
                  </p>
                  <div className="grid grid-cols-3 gap-2">
                    {BEHAVIOR_LABELS.map(label => (
                      <button
                        key={label}
                        onClick={() => setSelectedLabel(label)}
                        className={`py-2.5 rounded-xl border text-sm font-medium transition-all ${
                          selectedLabel === label
                            ? 'border-primary bg-primary/15 text-primary-light scale-[1.03]'
                            : 'border-border bg-surface-light text-text-secondary hover:border-primary/40'
                        }`}
                      >
                        {LABEL_EMOJI[label]} {getLabel(label)}
                      </button>
                    ))}
                  </div>
                </>
              )}

              <button
                onClick={() => setSelectedLabel('other' as SoundType)}
                className={`w-full py-2.5 rounded-xl border text-sm font-medium transition-all ${
                  selectedLabel === 'other'
                    ? 'border-primary bg-primary/15 text-primary-light scale-[1.03]'
                    : 'border-border bg-surface-light text-text-secondary hover:border-primary/40'
                }`}
              >
                {LABEL_EMOJI.other} Otro
              </button>

              {saving ? (
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-text-secondary font-medium">
                      Subiendo {captureMode === 'photo' ? 'foto' : captureMode === 'video' ? 'video' : 'audio'}...
                    </span>
                    <span className="text-primary-light font-bold">{uploadProgress}%</span>
                  </div>
                  <div className="h-3 rounded-full bg-surface-light border border-border overflow-hidden">
                    <div
                      className="h-full rounded-full bg-gradient-to-r from-primary to-primary-glow transition-all duration-300 ease-out"
                      style={{ width: `${uploadProgress}%` }}
                    />
                  </div>
                  {uploadProgress === 100 && (
                    <p className="text-[11px] text-text-muted text-center">Procesando en servidor...</p>
                  )}
                </div>
              ) : (
                <div className="flex gap-3">
                  <button
                    onClick={() => { setConfirmed(false); setSelectedLabel(null) }}
                    className="py-3 px-4 rounded-xl border border-border text-text-muted text-sm font-medium hover:bg-surface-light active:scale-95 transition-all"
                  >
                    Volver
                  </button>
                  <button
                    onClick={handleSend}
                    disabled={!selectedLabel}
                    className="flex-1 py-3 rounded-xl bg-primary text-white font-bold text-sm shadow-lg shadow-primary/30 hover:brightness-110 active:scale-95 disabled:opacity-40 transition-all"
                  >
                    Enviar {captureMode === 'photo' ? 'foto' : captureMode === 'video' ? 'video' : 'audio'}
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* ===== HISTORY TAB ===== */}
      {topTab === 'history' && (
        <div className="space-y-3">
          {/* Label distribution */}
          {stats && stats.total > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {Object.entries(stats.by_label).map(([label, count]) => (
                <span key={label} className="text-[11px] px-2.5 py-1 rounded-full bg-surface-light border border-border text-text-secondary font-medium">
                  {LABEL_EMOJI[label] || '❓'} {getLabel(label as SoundType)}: {count}
                </span>
              ))}
            </div>
          )}

          {clips.length === 0 ? (
            <div className="py-10 text-center">
              <p className="text-sm text-text-muted">Todavía no hay clips.</p>
              <button onClick={() => setTopTab('capture')} className="mt-2 text-xs text-primary-light font-medium hover:underline">
                Grabar el primero
              </button>
            </div>
          ) : (
            <>
              <div className="flex items-center justify-between px-1">
                <p className="text-xs text-text-muted font-medium">{clips.length} clips</p>
                {stats && stats.processed > 0 && (
                  <button onClick={handlePurge} className="text-[11px] text-text-muted hover:text-danger font-medium transition-colors">
                    Purgar procesados
                  </button>
                )}
              </div>

              <div className="space-y-2 max-h-[55vh] overflow-y-auto">
                {clips.map(clip => (
                  <div key={clip.id} className="flex items-center gap-3 bg-surface border border-border/50 rounded-xl px-3 py-2.5">
                    <span className="text-lg">{LABEL_EMOJI[clip.label] || '❓'}</span>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium text-text truncate">
                        {getLabel(clip.label as SoundType)} · {clip.dog_name}
                        {clip.has_video && ' 🎬'}
                        {clip.has_photo && ' 📷'}
                      </p>
                      <p className="text-[10px] text-text-muted">
                        {clip.media_type} · {clip.duration_ms > 0 ? `${Math.round(clip.duration_ms / 1000)}s · ` : ''}{new Date(clip.created_at).toLocaleString('es-AR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}
                      </p>
                    </div>
                    {clip.processed && (
                      <span className="text-[10px] px-2 py-0.5 rounded-full bg-success/15 text-success-light font-medium">ML</span>
                    )}
                  </div>
                ))}
              </div>
            </>
          )}
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
