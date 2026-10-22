import type { User } from './types'
import { api, setToken } from './api'

const USER_KEY = 'ballotbox.session.user'

export function getSession(): User | null {
  const raw = localStorage.getItem(USER_KEY)
  if (!raw) return null
  try {
    return JSON.parse(raw) as User
  } catch {
    localStorage.removeItem(USER_KEY)
    return null
  }
}

export async function signIn(
  identifier: string,
  password: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    const res = await api<{ token: string; user: User }>('/api/v1/auth/login', {
      method: 'POST',
      body: { identifier: identifier.trim(), password },
    })
    saveSession(res.token, res.user)
    return { ok: true }
  } catch (err) {
    return { ok: false, error: errMessage(err, 'Sign-in failed. Please try again.') }
  }
}

export async function signUp(input: {
  fullName: string
  email: string
  matricNo: string | null
  password: string
}): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    const res = await api<{ token: string; user: User }>('/api/v1/auth/register', {
      method: 'POST',
      body: {
        fullname: input.fullName, // the API contract spells this lowercase-'n'
        email: input.email,
        matricNo: input.matricNo ?? undefined,
        password: input.password,
      },
    })
    saveSession(res.token, res.user)
    return { ok: true }
  } catch (err) {
    return { ok: false, error: errMessage(err, 'Registration failed. Please try again.') }
  }
}

/**
 * Re-validates a stored session on boot so a dead token never renders a
 * logged-in shell. Returns null when there is nothing to restore.
 */
export async function restoreSession(): Promise<User | null> {
  if (!getSession()) return null
  try {
    const res = await api<{ user: User }>('/api/v1/auth/me')
    localStorage.setItem(USER_KEY, JSON.stringify(res.user))
    return res.user
  } catch {
    return null
  }
}

export async function signOut(): Promise<void> {
  try {
    await api('/api/v1/auth/logout', { method: 'POST' })
  } catch {
    // The token may already be dead; the local clear below is what matters.
  }
  setToken(null)
  localStorage.removeItem(USER_KEY)
}

function saveSession(token: string, user: User): void {
  setToken(token)
  localStorage.setItem(USER_KEY, JSON.stringify(user))
}

function errMessage(err: unknown, fallback: string): string {
  return err instanceof Error && err.message ? err.message : fallback
}

window.addEventListener('ballotbox:unauthorized', () => {
  localStorage.removeItem(USER_KEY)
  if (!location.hash.startsWith('#/auth')) location.hash = '#/auth/signin'
})
