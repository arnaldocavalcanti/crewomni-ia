'use client'

const TOKEN_KEY = 'crewomni_access_token'

export function getAccessToken(): string | null {
  if (typeof window === 'undefined') return null
  return localStorage.getItem(TOKEN_KEY)
}

export function setAccessToken(token: string): void {
  localStorage.setItem(TOKEN_KEY, token)
  if (typeof window !== 'undefined') {
    const secure = window.location.protocol === 'https:' ? '; Secure' : ''
    document.cookie = `auth-token=${token}; path=/; max-age=3600; SameSite=Lax${secure}`
  }
}

export function clearAccessToken(): void {
  localStorage.removeItem(TOKEN_KEY)
  if (typeof window !== 'undefined') {
    document.cookie = 'auth-token=; path=/; max-age=0; SameSite=Lax'
  }
}

export function isAuthenticated(): boolean {
  return !!getAccessToken()
}
