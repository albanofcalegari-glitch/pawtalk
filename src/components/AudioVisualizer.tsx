import { useRef, useEffect } from 'react'

interface Props {
  analyser: React.RefObject<AnalyserNode | null>
  isActive: boolean
}

export function AudioVisualizer({ analyser, isActive }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const frameRef = useRef<number>(0)

  useEffect(() => {
    if (!isActive || !analyser.current || !canvasRef.current) return

    const canvas = canvasRef.current
    const ctx = canvas.getContext('2d')!
    const node = analyser.current
    const bufferLength = node.frequencyBinCount
    const dataArray = new Uint8Array(bufferLength)

    const draw = () => {
      node.getByteFrequencyData(dataArray)

      const dpr = window.devicePixelRatio || 1
      canvas.width = canvas.offsetWidth * dpr
      canvas.height = canvas.offsetHeight * dpr
      ctx.scale(dpr, dpr)

      const w = canvas.offsetWidth
      const h = canvas.offsetHeight

      ctx.clearRect(0, 0, w, h)

      // Draw mirrored bars from center
      const barCount = 32
      const gap = 2
      const totalWidth = w * 0.85
      const barWidth = (totalWidth - gap * (barCount * 2 - 1)) / (barCount * 2)
      const startX = (w - totalWidth) / 2
      const step = Math.floor(bufferLength / barCount)
      const centerY = h / 2

      for (let i = 0; i < barCount; i++) {
        const value = dataArray[i * step] / 255
        const barHeight = Math.max(3, value * h * 0.4)

        // Gradient based on intensity
        const hue = 260 + value * 40 // purple to pink
        const alpha = 0.5 + value * 0.5

        ctx.fillStyle = `hsla(${hue}, 80%, 65%, ${alpha})`
        ctx.shadowColor = `hsla(${hue}, 80%, 65%, 0.4)`
        ctx.shadowBlur = value * 8

        // Right side
        const rx = startX + barCount * (barWidth + gap) + i * (barWidth + gap)
        ctx.beginPath()
        ctx.roundRect(rx, centerY - barHeight, barWidth, barHeight * 2, 2)
        ctx.fill()

        // Left side (mirror)
        const lx = startX + (barCount - 1 - i) * (barWidth + gap)
        ctx.beginPath()
        ctx.roundRect(lx, centerY - barHeight, barWidth, barHeight * 2, 2)
        ctx.fill()
      }

      ctx.shadowBlur = 0
      frameRef.current = requestAnimationFrame(draw)
    }

    draw()
    return () => cancelAnimationFrame(frameRef.current)
  }, [analyser, isActive])

  if (!isActive) {
    return (
      <div className="w-full h-16 rounded-2xl bg-surface border border-border/50 flex items-center justify-center">
        <div className="flex items-center gap-1">
          {Array.from({ length: 20 }).map((_, i) => (
            <div
              key={i}
              className="w-1 bg-text-muted/20 rounded-full"
              style={{ height: `${4 + Math.sin(i * 0.5) * 3}px` }}
            />
          ))}
        </div>
      </div>
    )
  }

  return (
    <canvas
      ref={canvasRef}
      className="w-full h-16 rounded-2xl bg-surface/80 border border-border/30"
    />
  )
}
