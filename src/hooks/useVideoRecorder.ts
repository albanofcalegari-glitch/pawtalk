import { useRef, useState, useCallback } from 'react'

export function useVideoRecorder() {
  const [isRecording, setIsRecording] = useState(false)
  const [duration, setDuration] = useState(0)
  const [error, setError] = useState<string | null>(null)
  const [preview, setPreview] = useState<string | null>(null)

  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const chunksRef = useRef<Blob[]>([])
  const timerRef = useRef<number>(0)
  const startTimeRef = useRef<number>(0)
  const videoRef = useRef<HTMLVideoElement | null>(null)

  const startPreview = useCallback(async (videoEl: HTMLVideoElement) => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment', width: { ideal: 1280 }, height: { ideal: 720 } },
        audio: true,
      })
      streamRef.current = stream
      videoEl.srcObject = stream
      videoRef.current = videoEl
      setPreview('live')
      setError(null)
    } catch (err: any) {
      setError(err.message || 'No se pudo acceder a la cámara')
    }
  }, [])

  const stopPreview = useCallback(() => {
    streamRef.current?.getTracks().forEach(t => t.stop())
    streamRef.current = null
    if (videoRef.current) videoRef.current.srcObject = null
    videoRef.current = null
    setPreview(null)
  }, [])

  const start = useCallback(() => {
    const stream = streamRef.current
    if (!stream) return

    const mimeType = MediaRecorder.isTypeSupported('video/webm;codecs=vp9,opus')
      ? 'video/webm;codecs=vp9,opus'
      : 'video/webm'

    const recorder = new MediaRecorder(stream, { mimeType })
    mediaRecorderRef.current = recorder
    chunksRef.current = []

    recorder.ondataavailable = (e) => {
      if (e.data.size > 0) chunksRef.current.push(e.data)
    }

    recorder.start(100)
    startTimeRef.current = Date.now()

    timerRef.current = window.setInterval(() => {
      setDuration(Math.floor((Date.now() - startTimeRef.current) / 1000))
    }, 500)

    setIsRecording(true)
    setDuration(0)
    setError(null)
  }, [])

  const stop = useCallback((): Promise<Blob> => {
    return new Promise((resolve, reject) => {
      const recorder = mediaRecorderRef.current
      if (!recorder || recorder.state === 'inactive') {
        reject(new Error('No hay grabación activa'))
        return
      }

      clearInterval(timerRef.current)

      recorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: 'video/webm' })
        mediaRecorderRef.current = null
        setIsRecording(false)
        setDuration(0)
        resolve(blob)
      }

      recorder.stop()
    })
  }, [])

  const cancel = useCallback(() => {
    clearInterval(timerRef.current)
    mediaRecorderRef.current?.stop()
    mediaRecorderRef.current = null
    chunksRef.current = []
    setIsRecording(false)
    setDuration(0)
  }, [])

  const takePhoto = useCallback((): Blob | null => {
    const video = videoRef.current
    if (!video) return null

    const canvas = document.createElement('canvas')
    canvas.width = video.videoWidth
    canvas.height = video.videoHeight
    const ctx = canvas.getContext('2d')
    if (!ctx) return null

    ctx.drawImage(video, 0, 0)

    const dataUrl = canvas.toDataURL('image/jpeg', 0.85)
    const byteString = atob(dataUrl.split(',')[1])
    const ab = new ArrayBuffer(byteString.length)
    const ia = new Uint8Array(ab)
    for (let i = 0; i < byteString.length; i++) {
      ia[i] = byteString.charCodeAt(i)
    }
    return new Blob([ab], { type: 'image/jpeg' })
  }, [])

  return {
    isRecording,
    duration,
    error,
    preview,
    startPreview,
    stopPreview,
    start,
    stop,
    cancel,
    takePhoto,
  }
}
