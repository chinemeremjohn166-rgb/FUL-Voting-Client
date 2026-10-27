// Who is signed in right now, and remembering that between page reloads.
//
// The API keeps its own copy of the session in an httpOnly cookie, plus a token
// we store so requests can carry it. We also save a small copy of the user here
// so the page can show a name immediately, without waiting for a request.

import {
  getToken,
  login,
  readLoggedInUser,
  register,
  resendVerificationCode,
  setToken,
  tellServerToLogOut,
  verifyEmailCode,
} from './api'
import { clearReceipts } from './receipts'
import { RegisterResult, User } from './types'

const USER_KEY = 'ballotbox.user'

/** Reads the saved user without contacting the server, or null if nobody is signed in. */
export function getUser(): User | null {
  const saved = localStorage.getItem(USER_KEY)
  if (!saved) return null
  try {
    const parsed: unknown = JSON.parse(saved)
    if (!isUser(parsed)) throw new Error('not a user')
    return parsed
  } catch {
    // localStorage belongs to this browser, not to us: an entry may be
    // hand-edited, truncated, or left over from an older build. A half-shaped
    // "user" would draw a logged-in page for somebody the server has never
    // seen, so anything that does not fit the shape is discarded.
    localStorage.removeItem(USER_KEY)
    return null
  }
}

function isUser(value: unknown): value is User {
  if (typeof value !== 'object' || value === null) return false
  const user = value as Record<string, unknown>
  return (
    typeof user.id === 'string' &&
    typeof user.email === 'string' &&
    typeof user.fullName === 'string' &&
    (user.matricNo === null || user.matricNo === undefined || typeof user.matricNo === 'string') &&
    (user.role === 'VOTER' || user.role === 'ADMIN')
  )
}

export function isAdmin(): boolean {
  const user = getUser()
  return user !== null && user.role === 'ADMIN'
}

function saveUser(user: User): void {
  localStorage.setItem(USER_KEY, JSON.stringify(user))
}

export function clearSession(): void {
  setToken(null)
  localStorage.removeItem(USER_KEY)
  clearReceipts()
}

/** Returns the user on success, or the server's message as an error. */
export async function logIn(
  identifier: string,
  password: string
): Promise<{ user: User } | { error: string; requiresVerification?: boolean; email?: string }> {
  try {
    const user = await login(identifier, password)
    saveUser(user)
    return { user }
  } catch (error: any) {
    return {
      error: error.message,
      requiresVerification: Boolean(error.data?.requiresVerification),
      email: error.data?.email,
    }
  }
}

export async function signUp(input: {
  fullName: string
  email: string
  matricNo: string | null
  password: string
}): Promise<RegisterResult | { error: string }> {
  try {
    const result = await register(input)
    return result
  } catch (error: any) {
    return { error: error.message }
  }
}

export async function verifyEmail(email: string, code: string): Promise<{ user: User } | { error: string }> {
  try {
    const user = await verifyEmailCode(email, code)
    saveUser(user)
    return { user }
  } catch (error: any) {
    return { error: error.message }
  }
}

export async function resendCode(email: string): Promise<{ message: string } | { error: string }> {
  try {
    const res = await resendVerificationCode(email)
    return { message: res.message }
  } catch (error: any) {
    return { error: error.message }
  }
}

/**
 * Runs once when the app starts. A saved user proves nothing on its own, so we
 * ask the server whether the token still works before showing a logged-in page.
 */
export async function checkSavedLogin(): Promise<void> {
  if (!getUser()) {
    // A token with no saved user is not ours to use — hand-edited storage, or a
    // leftover from an older build. Sent along anyway it would turn a public
    // page into a refused request, so drop it.
    if (getToken()) setToken(null)
    return
  }
  if (!getToken()) return
  try {
    const user = await readLoggedInUser()
    saveUser(user)
  } catch (error: any) {
    // Only a 401 says the token itself is refused — then forget it, and main.ts
    // shows the sign-in page. Any other failure (the server is restarting, the
    // laptop lost the network) keeps the sign-in, because throwing the user out
    // for a problem that is not theirs is the worse mistake.
    if (error.status === 401) clearSession()
  }
}

export async function logOut(): Promise<void> {
  try {
    await tellServerToLogOut()
  } catch {
    // Even if the server says no, the local clear below is what counts.
  }
  clearSession()
}
