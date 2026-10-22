import type { Route } from '../router'
import { nav } from '../router'
import { getSession, signIn, signUp } from '../state'
import { banner, field, h, icon, setBusy, toast } from '../ui'

function authLayout(active: 'signin' | 'register', form: HTMLElement): HTMLElement {
  const tab = (page: 'signin' | 'register', label: string, hash: string) =>
    h('a', { class: `auth-tab ${active === page ? 'active' : ''}`, href: hash }, label)

  return h('div', { class: 'auth-wrap' },
    h('div', { class: 'auth-card' },
      h('aside', { class: 'auth-panel' },
        h('a', { class: 'brand auth-brand', href: '#/' },
          h('span', { class: 'brand-mark' }, icon('box', 20)),
          h('span', { class: 'brand-name', text: 'BallotBox' }),
        ),
        h('div', { class: 'auth-panel-lead' },
          h('h1', { text: 'Secret ballots, verifiable results' }),
          h('p', { text: 'Cast your vote, get an anonymous receipt, and verify it later — your choices are never linked to your identity.' }),
        ),
        h('ul', { class: 'auth-points' },
          h('li', {}, icon('check', 16), ' One secret ballot per voter, enforced server-side'),
          h('li', {}, icon('check', 16), ' Anonymous votes with hour-level timestamps'),
          h('li', {}, icon('check', 16), ' Receipt codes you can verify independently'),
        ),
        h('div', { class: 'auth-panel-foot' },
          banner('info', 'Sessions last 24 hours. Sign-in attempts are rate-limited to 20 per 15 minutes.'),
        ),
      ),
      h('div', { class: 'auth-side' },
        h('div', { class: 'auth-tabs', role: 'tablist' },
          tab('signin', 'Sign in', '#/auth/signin'),
          tab('register', 'Create account', '#/auth/register'),
        ),
        form,
      ),
    ),
  )
}

function formError(): HTMLElement {
  return h('p', { class: 'form-error', style: 'display:none' })
}

function showError(el: HTMLElement, message: string): void {
  el.textContent = message
  el.style.display = 'block'
}

export function renderSignIn(_route: Route): HTMLElement {
  const loginId = h('input', { class: 'input', type: 'text', placeholder: 'you@student.edu or CSC/2023/001', autocomplete: 'username' }) as HTMLInputElement
  const loginPass = h('input', { class: 'input', type: 'password', placeholder: 'Your password', autocomplete: 'current-password' }) as HTMLInputElement
  const error = formError()
  const submitBtn = h('button', { class: 'btn primary block lg', type: 'submit' }, 'Sign in') as HTMLButtonElement

  const form = h('form', { class: 'stack-form auth-form', novalidate: 'novalidate' },
    h('h2', { text: 'Welcome back' }),
    h('p', { class: 'muted auth-sub', text: 'Sign in with your email address or matric number.' }),
    field('Email or matric number', loginId),
    field('Password', loginPass),
    error,
    submitBtn,
  )

  let busy = false

  async function onSubmit(): Promise<void> {
    if (busy) return
    if (!loginId.value.trim() || !loginPass.value) {
      showError(error, 'Enter your identifier and password.')
      return
    }
    busy = true
    setBusy(submitBtn, true, 'Signing in…')
    const result = await signIn(loginId.value, loginPass.value)
    busy = false
    setBusy(submitBtn, false)
    if (!result.ok) {
      showError(error, result.error)
      return
    }
    toast(`Welcome back, ${getSession()?.fullName.split(' ')[0] ?? 'voter'}`, 'success')
    nav('/elections')
  }

  form.addEventListener('submit', (e) => {
    e.preventDefault()
    void onSubmit()
  })

  return authLayout('signin', form)
}

const PASSWORD_RE = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,72}$/

export function renderRegister(_route: Route): HTMLElement {
  const regName = h('input', { class: 'input', type: 'text', placeholder: 'Full name', autocomplete: 'name' }) as HTMLInputElement
  const regEmail = h('input', { class: 'input', type: 'email', placeholder: 'you@student.edu', autocomplete: 'email' }) as HTMLInputElement
  const regMatric = h('input', { class: 'input', type: 'text', placeholder: 'CSC/2023/001 (optional)' }) as HTMLInputElement
  const regPass = h('input', { class: 'input', type: 'password', placeholder: 'Minimum 8 characters', autocomplete: 'new-password' }) as HTMLInputElement
  const error = formError()
  const submitBtn = h('button', { class: 'btn primary block lg', type: 'submit' }, 'Create account') as HTMLButtonElement

  const form = h('form', { class: 'stack-form auth-form', novalidate: 'novalidate' },
    h('h2', { text: 'Create your account' }),
    h('p', { class: 'muted auth-sub', text: 'Registration does not enroll you in an election — an administrator must add you to the voter roll.' }),
    field('Full name', regName),
    field('Email address', regEmail),
    field('Matric number', regMatric),
    field('Password', regPass, '8–72 characters with upper, lower, digit and one of @$!%*?&'),
    error,
    submitBtn,
  )

  let busy = false

  async function onSubmit(): Promise<void> {
    if (busy) return
    if (!regName.value.trim() || !regEmail.value.trim()) {
      showError(error, 'Name and email are required.')
      return
    }
    if (!PASSWORD_RE.test(regPass.value)) {
      showError(error, 'Password must be 8–72 characters and include an uppercase letter, a lowercase letter, a digit and a special character (@$!%*?&).')
      return
    }
    busy = true
    setBusy(submitBtn, true, 'Creating account…')
    const result = await signUp({
      fullName: regName.value.trim(),
      email: regEmail.value.trim(),
      matricNo: regMatric.value.trim() || null,
      password: regPass.value,
    })
    busy = false
    setBusy(submitBtn, false)
    if (!result.ok) {
      showError(error, result.error)
      return
    }
    toast('Account created — welcome to BallotBox', 'success')
    nav('/elections')
  }

  form.addEventListener('submit', (e) => {
    e.preventDefault()
    void onSubmit()
  })

  return authLayout('register', form)
}
