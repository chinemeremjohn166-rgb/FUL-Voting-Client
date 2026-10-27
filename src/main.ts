// This is the only file the browser loads. It does three things:
//
//   1. looks at the address bar (#/elections/abc) and works out which page that is
//   2. puts the shared top bar and the page's HTML into the <div id="app">
//   3. while a page is still waiting on the server, shows the grey loading lines
//
// A page is just an object: { title, render, bind }. Everything else lives in
// src/pages/, one file per screen.

import './style.css'
import { checkSavedLogin, clearSession, getUser, logOut } from './session'
import { Page } from './types'
import { avatar, errorHtml, esc, icon, loadingHtml, setBusy, toast } from './ui'
import { adminElectionPage } from './pages/admin-election-page'
import { adminNewPage } from './pages/admin-new-page'
import { adminPage } from './pages/admin-page'
import { ballotPage } from './pages/ballot-page'
import { electionPage } from './pages/election-page'
import { electionsPage } from './pages/elections-page'
import { receiptPage } from './pages/receipt-page'
import { registerPage, signInPage, verifyEmailPage } from './pages/auth-page'
import { resultsPage } from './pages/results-page'
import { verifyPage } from './pages/verify-page'

const app = document.querySelector<HTMLElement>('#app')

/**
 * Every route change bumps this. If a slow request from an old page finally
 * arrives after the user has moved on, its number no longer matches and its
 * HTML is thrown away instead of landing on the wrong screen.
 */
let current = 0

// --------------------------------------------------------------- the routing

/** '#/elections/abc?x=1' becomes { parts: ['elections', 'abc'], query: ... } */
function readAddress(): { parts: string[]; query: URLSearchParams } {
  const hash = location.hash.replace(/^#/, '') || '/'
  const [path = '/', queryString = ''] = hash.split('?')
  return { parts: path.split('/').filter(Boolean), query: new URLSearchParams(queryString) }
}

/** Which page object this address asks for — or 'go' plus a path to send there. */
function findPage(parts: string[], query: URLSearchParams): Page | { go: string } {
  const user = getUser()

  // Anyone may check a receipt, signed in or not.
  if (parts[0] === 'verify') return verifyPage(query.get('code') ?? '', query.get('election') ?? '')

  if (parts[0] === 'auth') {
    if (user) return { go: user.role === 'ADMIN' ? '#/admin' : '#/elections' }
    if (parts[1] === 'register') return registerPage()
    if (parts[1] === 'verify-email') return verifyEmailPage(query.get('email') ?? '')
    return signInPage()
  }

  // Everything else needs a signed-in user.
  if (!user) return { go: '#/auth/signin' }

  if (!parts.length) return { go: user.role === 'ADMIN' ? '#/admin' : '#/elections' }

  if (parts[0] === 'elections') {
    if (parts.length === 1) return electionsPage()
    if (parts[2] === 'ballot') return ballotPage(parts[1])
    if (parts[2] === 'results') return resultsPage(parts[1])
    if (!parts[2]) return electionPage(parts[1])
  }
  if (parts[0] === 'receipt' && parts[1]) return receiptPage(parts[1])

  if (parts[0] === 'admin') {
    if (user.role !== 'ADMIN') return { go: '#/elections' }
    if (parts.length === 1) return adminPage()
    if (parts[1] === 'new') return adminNewPage()
    if (parts[1] === 'elections' && parts[2]) return adminElectionPage(parts[2])
  }

  return notFoundPage()
}

function notFoundPage(): Page {
  return {
    title: 'Not found',
    render: async () => `<div class="page-head"><h1>Page not found</h1></div>
      <a class="btn ghost" href="#/elections">${icon('arrowLeft', 15)} Back to elections</a>`,
  }
}

// ------------------------------------------------------------------ drawing

async function drawPage(page: Page, parts: string[]): Promise<void> {
  if (!app) return
  const me = ++current

  document.title = `BallotBox · ${page.title}`
  app.innerHTML = shellHtml(parts)

  const view = app.querySelector<HTMLElement>('.view')
  if (!view) return
  view.setAttribute('aria-busy', 'true')

  try {
    const html = await page.render()
    if (me !== current) return // the user has moved on while we were waiting
    view.removeAttribute('aria-busy')
    view.innerHTML = html
    if (page.bind) page.bind(view)
    moveToPageHeading(view)
  } catch (error: any) {
    if (me !== current) return
    view.removeAttribute('aria-busy')
    // A 401 from the server means the saved login has expired.
    if (error.status === 401) {
      clearSession()
      location.hash = '#/auth/signin'
      return
    }
    view.innerHTML = errorHtml(error.message || 'The voting server did not answer.')
    const retry = view.querySelector<HTMLButtonElement>('button[data-retry]')
    if (retry) retry.addEventListener('click', route)
    moveToPageHeading(view)
  }

  bindSignOut()
}

/**
 * Building a page throws away whatever had focus, which leaves a keyboard user
 * at the top of the document with no idea that anything changed. Put the focus
 * on the page's own heading so the next Tab starts where the eye would.
 *
 * Only when focus really was lost: a click on a link or button still has it.
 */
function moveToPageHeading(view: HTMLElement): void {
  if (document.activeElement !== document.body) return
  const heading = view.querySelector<HTMLElement>('h1')
  if (!heading) return
  heading.setAttribute('tabindex', '-1')
  heading.focus()
}

function route(): void {
  const { parts, query } = readAddress()
  const page = findPage(parts, query)
  // 'go' means this address is not this user's to see — send them elsewhere.
  // Changing the hash makes the browser call route() again, from there.
  if ('go' in page) {
    location.hash = page.go
    return
  }
  void drawPage(page, parts)
}

// ---------------------------------------------------------------- the chrome

function navLink(active: string, href: string, label: string, iconName: string, match: string): string {
  return `<a class="nav-link ${active === match ? 'active' : ''}" href="${esc(href)}">${icon(iconName, 16)} ${esc(label)}</a>`
}

function topbarHtml(parts: string[]): string {
  const user = getUser()
  const active = parts[0] ?? ''

  const links = user
    ? (user.role === 'ADMIN' ? navLink(active, '#/admin', 'Administration', 'shield', 'admin') : '') +
      navLink(active, '#/elections', 'Elections', 'box', 'elections') +
      navLink(active, '#/verify', 'Verify receipt', 'search', 'verify')
    : navLink(active, '#/verify', 'Verify receipt', 'search', 'verify')

  const area = user
    ? `<div class="user-area">
        ${avatar(user.fullName, null, 32)}
        <div class="user-meta">
          <strong>${esc(user.fullName)}</strong>
          <span class="muted sm-text">${user.role === 'ADMIN' ? 'Administrator' : esc(user.matricNo ?? 'Voter')}</span>
        </div>
        <button class="btn ghost sm" type="button" data-signout>${icon('logout', 15)} Sign out</button>
      </div>`
    : '<a class="btn primary sm" href="#/auth/signin">Sign in</a>'

  const brandHref = user ? (user.role === 'ADMIN' ? '#/admin' : '#/elections') : '#/'

  return `<header class="topbar">
    <div class="topbar-inner">
      <a class="brand" href="${brandHref}">
        <span class="brand-mark">${icon('box', 20)}</span>
        <span class="brand-name">BallotBox</span>
      </a>
      <nav class="nav">${links}</nav>
      ${area}
    </div>
  </header>`
}

function shellHtml(parts: string[]): string {
  return `${topbarHtml(parts)}
    <main class="container"><div class="view">${loadingHtml()}</div></main>
    <footer class="footer"><span>BallotBox — election data comes from the local voting API on port 8000.</span></footer>`
}

function bindSignOut(): void {
  const button = app?.querySelector<HTMLButtonElement>('button[data-signout]')
  if (!button) return
  button.addEventListener('click', () => {
    setBusy(button, true, 'Signing out…')
    void logOut().then(() => {
      toast('Signed out', 'info')
      location.hash = '#/auth/signin'
    })
  })
}

// -------------------------------------------------------------------- start

// Ask the server whether a saved login is still valid before drawing any page,
// so a dead session never shows a logged-in top bar.
if (app) {
  app.innerHTML = '<div class="boot-splash"><p class="muted">Loading BallotBox…</p></div>'
  window.addEventListener('hashchange', route)
  void checkSavedLogin().then(route)
}
