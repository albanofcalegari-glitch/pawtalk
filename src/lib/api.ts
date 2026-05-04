const API_URL = import.meta.env.VITE_API_URL ?? ''

function getToken(): string | null {
  return localStorage.getItem('pawtalk-token')
}

function authHeaders(): HeadersInit {
  const token = getToken()
  return token ? { Authorization: `Bearer ${token}` } : {}
}

async function request<T>(path: string, opts: RequestInit = {}): Promise<T> {
  const res = await fetch(`${API_URL}${path}`, {
    ...opts,
    headers: { ...authHeaders(), ...opts.headers },
  })
  if (!res.ok) {
    const body = await res.json().catch(() => ({ detail: res.statusText }))
    throw new Error(body.detail || 'Error de servidor')
  }
  return res.json()
}

export interface AuthResponse {
  access_token: string
  token_type: string
}

export interface UserResponse {
  id: number
  email: string
  name: string
}

export interface DogResponse {
  id: number
  name: string
  breed: string
  photo_url: string | null
}

export interface ClipResponse {
  id: number
  dog_id: number
  dog_name: string
  label: string
  media_type: string
  duration_ms: number
  has_video: boolean
  has_photo: boolean
  processed: boolean
  purged: boolean
  created_at: string
}

export interface ClipStats {
  total: number
  by_label: Record<string, number>
  by_dog: Record<string, number>
  by_media: Record<string, number>
  processed: number
  pending: number
  disk_mb: number
}

export const api = {
  register(email: string, name: string, password: string) {
    return request<AuthResponse>('/api/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, name, password }),
    })
  },

  login(email: string, password: string) {
    const body = new URLSearchParams({ username: email, password })
    return request<AuthResponse>('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: body.toString(),
    })
  },

  me() {
    return request<UserResponse>('/api/auth/me')
  },

  getDogs() {
    return request<DogResponse[]>('/api/dogs')
  },

  createDog(name: string, breed: string, photo?: File) {
    const form = new FormData()
    form.append('name', name)
    form.append('breed', breed)
    if (photo) form.append('photo', photo)
    return request<DogResponse>('/api/dogs', { method: 'POST', body: form })
  },

  updateDogPhoto(dogId: number, photo: File) {
    const form = new FormData()
    form.append('photo', photo)
    return request<DogResponse>(`/api/dogs/${dogId}/photo`, { method: 'PUT', body: form })
  },

  deleteDog(dogId: number) {
    return request<void>(`/api/dogs/${dogId}`, { method: 'DELETE' })
  },

  uploadClip(dogId: number, label: string, durationMs: number, opts: {
    audio?: Blob
    video?: Blob
    photo?: Blob
    mediaType?: 'audio' | 'video' | 'photo'
  }) {
    const form = new FormData()
    form.append('dog_id', dogId.toString())
    form.append('label', label)
    form.append('media_type', opts.mediaType || 'audio')
    form.append('duration_ms', durationMs.toString())
    if (opts.audio) form.append('audio', opts.audio, `clip_${Date.now()}.webm`)
    if (opts.video) form.append('video', opts.video, `clip_${Date.now()}_video.webm`)
    if (opts.photo) form.append('photo', opts.photo, `clip_${Date.now()}_photo.jpg`)
    return request<ClipResponse>('/api/clips', { method: 'POST', body: form })
  },

  getClips(dogId?: number, label?: string) {
    const params = new URLSearchParams()
    if (dogId) params.set('dog_id', dogId.toString())
    if (label) params.set('label', label)
    return request<ClipResponse[]>(`/api/clips?${params}`)
  },

  getClipStats() {
    return request<ClipStats>('/api/clips/stats')
  },

  purgeClips() {
    return request<{ purged: number; freed_mb: number }>('/api/clips/purge', { method: 'POST' })
  },
}
