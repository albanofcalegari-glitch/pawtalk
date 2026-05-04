import { getLabel, getMeaning, type ClassificationResult } from '../lib/audioClassifier'

interface Props {
  result: ClassificationResult
  timestamp: Date
  dog?: string
}

const TYPE_CONFIG: Record<string, { emoji: string; gradient: string; border: string; badge: string }> = {
  bark: { emoji: '🐕', gradient: 'from-amber-500/10 to-orange-500/5', border: 'border-amber-500/30', badge: 'bg-amber-500/15 text-amber-400' },
  whine: { emoji: '🥺', gradient: 'from-violet-500/10 to-purple-500/5', border: 'border-violet-500/30', badge: 'bg-violet-500/15 text-violet-400' },
  growl: { emoji: '😤', gradient: 'from-red-500/10 to-rose-500/5', border: 'border-red-500/30', badge: 'bg-red-500/15 text-red-400' },
  howl: { emoji: '🌙', gradient: 'from-blue-500/10 to-indigo-500/5', border: 'border-blue-500/30', badge: 'bg-blue-500/15 text-blue-400' },
  pant: { emoji: '😮‍💨', gradient: 'from-emerald-500/10 to-teal-500/5', border: 'border-emerald-500/30', badge: 'bg-emerald-500/15 text-emerald-400' },
  silence: { emoji: '😴', gradient: 'from-surface to-surface', border: 'border-border', badge: 'bg-surface-light text-text-muted' },
}

export function DetectionCard({ result, timestamp, dog }: Props) {
  const config = TYPE_CONFIG[result.type] || TYPE_CONFIG.silence
  const time = timestamp.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
  const meaning = getMeaning(result.type)

  return (
    <div className={`animate-slide-up border rounded-2xl p-4 bg-gradient-to-r ${config.gradient} ${config.border} transition-all hover:scale-[1.01]`}>
      <div className="flex items-start gap-3">
        <div className="text-3xl flex-shrink-0 mt-0.5">{config.emoji}</div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full ${config.badge}`}>
              {getLabel(result.type)}
            </span>
            {dog && (
              <span className="text-[11px] text-text-muted font-medium">{dog}</span>
            )}
          </div>
          <p className="text-sm text-text font-medium leading-snug">"{meaning}"</p>
          <div className="flex items-center gap-3 mt-2">
            <span className="text-[10px] text-text-muted">{time}</span>
            <span className="text-[10px] text-text-muted/60">
              {Math.round(result.confidence * 100)}% confianza
            </span>
            <span className="text-[10px] text-text-muted/60">
              {Math.round(result.dominantFreq)}Hz
            </span>
          </div>
        </div>
      </div>
    </div>
  )
}
