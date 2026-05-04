export type SoundType = 'bark' | 'whine' | 'growl' | 'howl' | 'pant' | 'silence'

export interface ClassificationResult {
  type: SoundType
  confidence: number
  dominantFreq: number
  energy: number
}

const LABELS: Record<SoundType, string> = {
  bark: 'Ladrido',
  whine: 'Gemido',
  growl: 'Gruñido',
  howl: 'Aullido',
  pant: 'Jadeo',
  silence: 'Silencio',
}

const MEANINGS: Record<SoundType, string[]> = {
  bark: ['¡Alerta!', '¡Quiero jugar!', '¡Hola humano!', '¡Algo se mueve!'],
  whine: ['Necesito algo...', 'Estoy ansioso', 'Me duele', 'Quiero atención'],
  growl: ['No me gusta esto', 'Aléjate', 'Estoy incómodo', 'Cuidado...'],
  howl: ['¡Los extraño!', '¿Dónde están?', 'Escuché algo raro', 'Estoy solo'],
  pant: ['Tengo calor', 'Estoy contento', 'Cansado del juego', 'Necesito agua'],
  silence: ['Todo tranquilo', 'Estoy relajado', 'Durmiendo...'],
}

export function getLabel(type: SoundType): string {
  return LABELS[type]
}

export function getMeaning(type: SoundType): string {
  const options = MEANINGS[type]
  return options[Math.floor(Math.random() * options.length)]
}

export function classifyAudio(analyser: AnalyserNode): ClassificationResult {
  const bufferLength = analyser.frequencyBinCount
  const freqData = new Uint8Array(bufferLength)
  const timeData = new Uint8Array(bufferLength)

  analyser.getByteFrequencyData(freqData)
  analyser.getByteTimeDomainData(timeData)

  const energy = freqData.reduce((sum, v) => sum + v, 0) / bufferLength
  const maxFreqIndex = freqData.indexOf(Math.max(...freqData))
  const sampleRate = analyser.context.sampleRate
  const dominantFreq = (maxFreqIndex * sampleRate) / (2 * bufferLength)

  // Zero crossing rate (roughness indicator)
  let zeroCrossings = 0
  for (let i = 1; i < timeData.length; i++) {
    if ((timeData[i] >= 128 && timeData[i - 1] < 128) ||
        (timeData[i] < 128 && timeData[i - 1] >= 128)) {
      zeroCrossings++
    }
  }
  const zcr = zeroCrossings / timeData.length

  // Spectral centroid
  let weightedSum = 0
  let totalMagnitude = 0
  for (let i = 0; i < freqData.length; i++) {
    weightedSum += i * freqData[i]
    totalMagnitude += freqData[i]
  }
  const spectralCentroid = totalMagnitude > 0 ? weightedSum / totalMagnitude : 0

  // Classification heuristics based on frequency analysis
  if (energy < 8) {
    return { type: 'silence', confidence: 0.95, dominantFreq, energy }
  }

  let type: SoundType = 'bark'
  let confidence = 0.6

  if (dominantFreq > 800 && energy > 40 && zcr > 0.1) {
    // High freq, high energy, sharp transitions = bark
    type = 'bark'
    confidence = 0.7 + Math.min(energy / 200, 0.25)
  } else if (dominantFreq > 500 && dominantFreq < 1200 && zcr < 0.08 && energy > 20) {
    // Sustained mid-freq, smooth = whine
    type = 'whine'
    confidence = 0.65
  } else if (dominantFreq < 400 && energy > 30 && zcr > 0.12) {
    // Low freq, rough = growl
    type = 'growl'
    confidence = 0.7
  } else if (dominantFreq > 300 && dominantFreq < 800 && spectralCentroid > bufferLength * 0.3 && energy > 25) {
    // Mid freq, wide spectrum, sustained = howl
    type = 'howl'
    confidence = 0.6
  } else if (energy > 10 && energy < 30 && zcr > 0.15) {
    // Low energy, high zcr = panting
    type = 'pant'
    confidence = 0.6
  }

  return { type, confidence, dominantFreq, energy }
}
