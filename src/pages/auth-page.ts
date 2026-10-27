// Sign in, create-account, and email verification. They share the same two-panel layout: the left
// side explains the app, the right side holds one form at a time.

import { logIn, resendCode, signUp, verifyEmail } from '../session'
import { Page } from '../types'
import { banner, esc, field, icon, setBusy, toast } from '../ui'

const PASSWORD_RULE = 'Password must be 8–72 characters (no spaces) and include an uppercase letter, a lowercase letter, a digit and a special character.'
const PASSWORD_OK = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z\d\s])\S{8,72}$/

function layout(active: 'signin' | 'register' | 'verify', formHtml: string, emailForVerify?: string): string {
  const tab = (name: 'signin' | 'register' | 'verify', label: string, href: string) =>
    `<a class="auth-tab ${active === name ? 'active' : ''}" href="${href}">${label}</a>`

  const verifyTab = active === 'verify' || emailForVerify
    ? tab('verify', 'Verify email', `#/auth/verify-email${emailForVerify ? `?email=${encodeURIComponent(emailForVerify)}` : ''}`)
    : ''

  return `<div class="auth-wrap">
    <div class="auth-card">
      <aside class="auth-panel">
        <a class="brand auth-brand" href="#/">
          <span class="brand-mark">${icon('box', 20)}</span>
          <span class="brand-name">BallotBox</span>
        </a>
        <div class="auth-panel-lead">
          <h1>Secret ballots, verifiable results</h1>
          <p>Cast your vote, get an anonymous receipt, and verify it later — your choices are never linked to your identity.</p>
        </div>
        <ul class="auth-points">
          <li>${icon('check', 16)} One secret ballot per voter, enforced server-side</li>
          <li>${icon('check', 16)} Anonymous votes with hour-level timestamps</li>
          <li>${icon('check', 16)} Receipt codes you can verify independently</li>
          <li>${icon('check', 16)} Verified email security powered by Resend</li>
        </ul>
        <div class="auth-panel-foot">
          ${banner('info', 'Sessions last 24 hours. Sign-in attempts are rate-limited to 20 per 15 minutes.')}
        </div>
      </aside>
      <div class="auth-side">
        <div class="auth-tabs" role="tablist">
          ${tab('signin', 'Sign in', '#/auth/signin')}
          ${tab('register', 'Create account', '#/auth/register')}
          ${verifyTab}
        </div>
        ${formHtml}
      </div>
    </div>
  </div>`
}

/** The red line above the submit button; hidden until something is wrong. */
function errorLine(): string {
  return '<p class="form-error" data-error role="alert" style="display:none"></p>'
}

function showError(root: HTMLElement, message: string): void {
  const line = root.querySelector('[data-error]')
  if (!line) return
  // Visible first, then filled — text arriving inside a visible role="alert" is
  // the one case a screen reader is guaranteed to speak.
  line.removeAttribute('style')
  line.textContent = message
}

function clearError(root: HTMLElement): void {
  const line = root.querySelector('[data-error]')
  if (line) line.setAttribute('style', 'display:none')
}

export function signInPage(): Page {
  return {
    title: 'Sign In',

    async render() {
      const form = `<form class="stack-form auth-form" novalidate>
        <h2>Welcome back</h2>
        <p class="muted auth-sub">Sign in with your email address or matric number.</p>
        ${field('Email or matric number', '<input class="input" type="text" name="identifier" placeholder="you@student.edu or CSC/2023/001" autocomplete="username">')}
        ${field('Password', '<input class="input" type="password" name="password" placeholder="Your password" autocomplete="current-password">')}
        ${errorLine()}
        <button class="btn primary block lg" type="submit">Sign in</button>
      </form>`
      return layout('signin', form)
    },

    bind(root) {
      const form = root.querySelector('form')
      const button = root.querySelector('button[type=submit]')
      if (!form || !button) return

      form.addEventListener('submit', async (event) => {
        event.preventDefault()
        clearError(root)

        const identifier = (form.elements.namedItem('identifier') as HTMLInputElement).value
        const password = (form.elements.namedItem('password') as HTMLInputElement).value
        if (!identifier.trim() || !password) return showError(root, 'Enter your identifier and password.')

        setBusy(button as HTMLButtonElement, true, 'Signing in…')
        const result = await logIn(identifier, password)
        setBusy(button as HTMLButtonElement, false)

        if ('error' in result) {
          if (result.requiresVerification && result.email) {
            toast(result.error, 'error')
            location.hash = `#/auth/verify-email?email=${encodeURIComponent(result.email)}`
            return
          }
          return showError(root, result.error)
        }

        toast(`Welcome back, ${result.user.fullName.split(' ')[0]}`, 'success')
        // Direct admin users straight to admin dashboard, voters to elections
        if (result.user.role === 'ADMIN') {
          location.hash = '#/admin'
        } else {
          location.hash = '#/elections'
        }
      })
    },
  }
}

export function registerPage(): Page {
  return {
    title: 'Create Account',

    async render() {
      const form = `<form class="stack-form auth-form" novalidate>
        <h2>Create your account</h2>
        <p class="muted auth-sub">Registration will send a verification code to your email address before activation.</p>
        ${field('Full name', '<input class="input" type="text" name="fullName" placeholder="Full name" autocomplete="name">')}
        ${field('Email address', '<input class="input" type="email" name="email" placeholder="you@student.edu" autocomplete="email">')}
        ${field('Matric number', '<input class="input" type="text" name="matricNo" placeholder="CSC/2023/001 (optional)">')}
        ${field('Password', '<input class="input" type="password" name="password" placeholder="Minimum 8 characters" autocomplete="new-password">', '8–72 characters with upper, lower, digit and a special character')}
        ${errorLine()}
        <button class="btn primary block lg" type="submit">Create account</button>
      </form>`
      return layout('register', form)
    },

    bind(root) {
      const form = root.querySelector('form')
      const button = root.querySelector('button[type=submit]')
      if (!form || !button) return

      form.addEventListener('submit', async (event) => {
        event.preventDefault()
        clearError(root)

        const fullName = (form.elements.namedItem('fullName') as HTMLInputElement).value.trim()
        const email = (form.elements.namedItem('email') as HTMLInputElement).value.trim()
        const matricNo = (form.elements.namedItem('matricNo') as HTMLInputElement).value.trim()
        const password = (form.elements.namedItem('password') as HTMLInputElement).value

        if (!fullName || !email) return showError(root, 'Name and email are required.')
        if (!PASSWORD_OK.test(password)) return showError(root, PASSWORD_RULE)

        setBusy(button as HTMLButtonElement, true, 'Creating account…')
        const result = await signUp({ fullName, email, matricNo: matricNo || null, password })
        setBusy(button as HTMLButtonElement, false)

        if ('error' in result) return showError(root, result.error)

        toast('Verification code sent to your email!', 'info')
        location.hash = `#/auth/verify-email?email=${encodeURIComponent(email)}`
      })
    },
  }
}

export function verifyEmailPage(initialEmail = ''): Page {
  return {
    title: 'Verify Email',

    async render() {
      const form = `<form class="stack-form auth-form" novalidate>
        <h2>Verify your email</h2>
        <p class="muted auth-sub">
          We sent a 6-digit verification code via email to <strong data-email-display>${esc(initialEmail || 'your email')}</strong>.
        </p>
        ${field(
          'Email address',
          `<input class="input" type="email" name="email" value="${esc(initialEmail)}" placeholder="you@student.edu" autocomplete="email">`,
        )}
        ${field(
          'Verification Code',
          '<input class="input" type="text" name="code" placeholder="123456" maxlength="10" autocomplete="one-time-code" style="letter-spacing: 6px; font-size: 20px; text-align: center; font-weight: bold;">',
          'Enter the 6-digit code received via email'
        )}
        ${errorLine()}
        <button class="btn primary block lg" type="submit">Verify &amp; Continue</button>
        <div style="margin-top: 16px; text-align: center;">
          <p class="muted sm-text" style="margin-bottom: 6px;">Didn't receive the email or code expired?</p>
          <button class="btn ghost sm" type="button" data-resend-btn>Resend verification code</button>
        </div>
        <div style="margin-top: 14px; text-align: center;">
          <a class="sm-text muted" href="#/auth/signin">← Back to sign in</a>
        </div>
      </form>`
      return layout('verify', form, initialEmail)
    },

    bind(root) {
      const form = root.querySelector('form')
      const submitBtn = root.querySelector('button[type=submit]')
      const resendBtn = root.querySelector<HTMLButtonElement>('button[data-resend-btn]')
      if (!form || !submitBtn) return

      const getEmail = (): string => {
        const emailInput = form.elements.namedItem('email') as HTMLInputElement | null
        return (emailInput?.value || initialEmail).trim()
      }

      form.addEventListener('submit', async (event) => {
        event.preventDefault()
        clearError(root)

        const email = getEmail()
        const codeInput = form.elements.namedItem('code') as HTMLInputElement
        const code = codeInput ? codeInput.value.trim() : ''

        if (!email) return showError(root, 'Email address is required.')
        if (!code) return showError(root, 'Enter the verification code.')

        setBusy(submitBtn as HTMLButtonElement, true, 'Verifying…')
        const result = await verifyEmail(email, code)
        setBusy(submitBtn as HTMLButtonElement, false)

        if ('error' in result) return showError(root, result.error)

        toast('Email verified successfully! Welcome to BallotBox.', 'success')
        if (result.user.role === 'ADMIN') {
          location.hash = '#/admin'
        } else {
          location.hash = '#/elections'
        }
      })

      if (resendBtn) {
        resendBtn.addEventListener('click', async () => {
          clearError(root)
          const email = getEmail()
          if (!email) return showError(root, 'Please enter your email address to resend code.')

          setBusy(resendBtn, true, 'Sending…')
          const result = await resendCode(email)
          setBusy(resendBtn, false)

          if ('error' in result) {
            showError(root, result.error)
          } else {
            toast('New verification code sent! Check your inbox.', 'success')
          }
        })
      }
    },
  }
}
