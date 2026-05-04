import { useRef, useState, useCallback } from 'react'

export interface RecorderState {
  isRecording: boolean
  duration: number
  error: string | null
}

export function useRecorder() {
  const [state, setState] = useState<RecorderState>({
    isRecording: false,
    duration: 0,
    error: null,
  })

  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const chunksRef = useRef<Blob[]>([])
  const timerRef = useRef<number>(0)
  const startTimeRef = useRef<number>(0)

  const start = useCallback(async (): Promise<void> => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      streamRef.current = stream

      const mediaRecorder = new MediaRecorder(stream, {
        mimeType: MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
          ? 'audio/webm;codecs=opus'
          : 'audio/webm',
      })
      mediaRecorderRef.current = mediaRecorder
      chunksRef.current = []

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data)
      }

      mediaRecorder.start(100)
      startTimeRef.current = Date.now()

      timerRef.current = window.setInterval(() => {
        setState(prev => ({
          ...prev,
          duration: Math.floor((Date.now() - startTimeRef.current) / 1000),
        }))
      }, 500)

      setState({ isRecording: true, duration: 0, error: null })
    } catch (err: any) {
      setState(prev => ({ ...prev, error: err.message || 'No se pudo acceder al micrófono' }))
    }
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
        const blob = new Blob(chunksRef.current, { type: 'audio/webm' })
        streamRef.current?.getTracks().forEach(t => t.stop())
        streamRef.current = null
        mediaRecorderRef.current = null
        setState({ isRecording: false, duration: 0, error: null })
        resolve(blob)
      }

      recorder.stop()
    })
  }, [])

  const cancel = useCallback(() => {
    clearInterval(timerRef.current)
    mediaRecorderRef.current?.stop()
    streamRef.current?.getTracks().forEach(t => t.stop())
    streamRef.current = null
    mediaRecorderRef.current = null
    chunksRef.current = []
    setState({ isRecording: false, duration: 0, error: null })
  }, [])

  return { ...state, start, stop, cancel }
}
