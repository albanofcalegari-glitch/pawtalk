import { useRef, useState, useCallback } from 'react'
import { classifyAudio, type ClassificationResult } from '../lib/audioClassifier'

export interface AudioCaptureState {
  isListening: boolean
  currentResult: ClassificationResult | null
  error: string | null
}

export function useAudioCapture(onDetection: (result: ClassificationResult) => void) {
  const [state, setState] = useState<AudioCaptureState>({
    isListening: false,
    currentResult: null,
    error: null,
  })

  const audioContextRef = useRef<AudioContext | null>(null)
  const analyserRef = useRef<AnalyserNode | null>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const frameRef = useRef<number>(0)
  const lastDetectionRef = useRef<number>(0)

  const processAudio = useCallback(() => {
    if (!analyserRef.current) return

    const result = classifyAudio(analyserRef.current)
    setState(prev => ({ ...prev, currentResult: result }))

    const now = Date.now()
    if (result.type !== 'silence' && result.confidence > 0.6 && now - lastDetectionRef.current > 2000) {
      lastDetectionRef.current = now
      onDetection(result)
    }

    frameRef.current = requestAnimationFrame(processAudio)
  }, [onDetection])

  const start = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      streamRef.current = stream

      const audioContext = new AudioContext()
      audioContextRef.current = audioContext

      const source = audioContext.createMediaStreamSource(stream)
      const analyser = audioContext.createAnalyser()
      analyser.fftSize = 2048
      analyser.smoothingTimeConstant = 0.8
      source.connect(analyser)
      analyserRef.current = analyser

      setState({ isListening: true, currentResult: null, error: null })
      frameRef.current = requestAnimationFrame(processAudio)
    } catch (err: any) {
      setState(prev => ({
        ...prev,
        error: err.message || 'No se pudo acceder al micrófono',
      }))
    }
  }, [processAudio])

  const stop = useCallback(() => {
    cancelAnimationFrame(frameRef.current)
    streamRef.current?.getTracks().forEach(t => t.stop())
    audioContextRef.current?.close()
    analyserRef.current = null
    audioContextRef.current = null
    streamRef.current = null
    setState({ isListening: false, currentResult: null, error: null })
  }, [])

  return { ...state, start, stop, analyser: analyserRef }
}
