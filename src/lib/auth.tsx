import { createContext, useContext, useState, useEffect, type ReactNode } from 'react'
import { api, type UserResponse, type DogResponse } from './api'

interface AuthState {
  user: UserResponse | null
  dogs: DogResponse[]
  loading: boolean
  login: (email: string, password: string) => Promise<void>
  register: (email: string, name: string, password: string) => Promise<void>
  logout: () => void
  refreshDogs: () => Promise<void>
}

const AuthContext = createContext<AuthState | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<UserResponse | null>(null)
  const [dogs, setDogs] = useState<DogResponse[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const token = localStorage.getItem('pawtalk-token')
    if (!token) {
      setLoading(false)
      return
    }
    api.me()
      .then(u => {
        setUser(u)
        return api.getDogs()
      })
      .then(setDogs)
      .catch(() => localStorage.removeItem('pawtalk-token'))
      .finally(() => setLoading(false))
  }, [])

  const login = async (email: string, password: string) => {
    const res = await api.login(email, password)
    localStorage.setItem('pawtalk-token', res.access_token)
    const u = await api.me()
    setUser(u)
    const d = await api.getDogs()
    setDogs(d)
  }

  const register = async (email: string, name: string, password: string) => {
    const res = await api.register(email, name, password)
    localStorage.setItem('pawtalk-token', res.access_token)
    const u = await api.me()
    setUser(u)
    setDogs([])
  }

  const logout = () => {
    localStorage.removeItem('pawtalk-token')
    setUser(null)
    setDogs([])
  }

  const refreshDogs = async () => {
    const d = await api.getDogs()
    setDogs(d)
  }

  return (
    <AuthContext.Provider value={{ user, dogs, loading, login, register, logout, refreshDogs }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be inside AuthProvider')
  return ctx
}
