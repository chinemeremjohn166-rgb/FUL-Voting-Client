// Small building blocks shared by every page.
//
// Most of these functions take text and give back a piece of HTML as a string,
// which pages glue together with template literals. Anything coming from the
// API or from a form MUST go through esc() first, or a user could put markup or
// a script into the page.

import { ElectionStatus } from './types'

/** Makes text safe to drop into HTML. */
export function esc(value: unknown): string {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

// ------------------------------------------------------------------- icons

const ICONS: Record<string, string> = {
  check: '<path d="M20 6 9 17l-5-5"/>',
  x: '<path d="M18 6 6 18M6 6l12 12"/>',
  clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
  users: '<circle cx="9" cy="8" r="3.5"/><path d="M2.5 20c.8-3.2 3.4-5 6.5-5s5.7 1.8 6.5 5"/><circle cx="17" cy="9" r="2.5"/><path d="M16 15.2c2.6.3 4.6 1.9 5.5 4.3"/>',
  chart: '<path d="M4 20V10M10 20V4M16 20v-7M21 20H3"/>',
  shield: '<path d="M12 3 5 6v5c0 4.5 3 8.2 7 10 4-1.8 7-5.5 7-10V6l-7-3z"/><path d="m9.5 12 1.8 1.8L15 10"/>',
  copy: '<rect x="9" y="9" width="12" height="12" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  trash: '<path d="M3 6h18M8 6V4a1 1 0 0 1 1-1h6a1 1 0 0 1 1 1v2M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/>',
  box: '<path d="M21 8 12 3 3 8v8l9 5 9-5V8z"/><path d="m3 8 9 5 9-5M12 13v8"/>',
  arrowLeft: '<path d="M19 12H5M12 19l-7-7 7-7"/>',
  arrowRight: '<path d="M5 12h14M12 5l7 7-7 7"/>',
  award: '<circle cx="12" cy="9" r="5"/><path d="m8.5 13.5-1.5 7 5-3 5 3-1.5-7"/>',
  alert: '<path d="M12 3 2 20h20L12 3z"/><path d="M12 10v4M12 17.5v.5"/>',
  search: '<circle cx="11" cy="11" r="7"/><path d="m21 21-4.3-4.3"/>',
  logout: '<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><path d="m16 17 5-5-5-5M21 12H9"/>',
  flag: '<path d="M4 22V4c4-2.5 8 2.5 12 0v10c-4 2.5-8-2.5-12 0"/>',
  eye: '<path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7z"/><circle cx="12" cy="12" r="3"/>',
  edit: '<path d="M17 3a2.8 2.8 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z"/>',
  calendar: '<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M16 3v4M8 3v4M3 11h18"/>',
}

/** The icon names above are hard-coded, so nothing a user typed can reach here. */
export function icon(name: string, size = 18): string {
  return `<svg viewBox="0 0 24 24" width="${size}" height="${size}" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICONS[name] ?? ''}</svg>`
}

// --------------------------------------------------------------- formatting

export function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' })
}

export function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString(undefined, { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })
}

function humanize(ms: number): string {
  const minutes = Math.round(Math.abs(ms) / 60000)
  // "under a minute" rather than "just now": both callers add words around it,
  // and "Closed just now ago" is not English.
  if (minutes < 1) return 'under a minute'
  if (minutes < 60) return `${minutes}m`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h ${minutes % 60}m`
  const days = Math.floor(hours / 24)
  return days < 7 ? `${days}d ${hours % 24}h` : `${days}d`
}

/** "Closes in 2d 4h", "Opens in 3d", "Closed 1d ago". */
export function windowLabel(iso: string, kind: 'start' | 'end'): string {
  const diff = new Date(iso).getTime() - Date.now()
  if (kind === 'start') return diff > 0 ? `Opens in ${humanize(diff)}` : 'Voting window open'
  return diff > 0 ? `Closes in ${humanize(diff)}` : `Closed ${humanize(diff)} ago`
}

/**
 * Where does this moment sit inside an election's voting window?
 *
 * An election can already have status OPEN while its starting time is still in
 * the future — the API set the status by hand. The server refuses ballots
 * outside the window, so every page that offers to vote checks it here first.
 */
export function windowState(startsAt: string, endsAt: string): 'pending' | 'live' | 'ended' {
  const now = Date.now()
  if (now < new Date(startsAt).getTime()) return 'pending'
  if (now > new Date(endsAt).getTime()) return 'ended'
  return 'live'
}

/** Converts an ISO timestamp into the value an `<input type="datetime-local">` wants. */
export function toLocalInput(iso: string): string {
  const d = new Date(iso)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

/** And back again, so the API receives a full ISO timestamp. */
export function fromLocalInput(value: string): string {
  return new Date(value).toISOString()
}

// ----------------------------------------------------------- small fragments

const STATUS_LABELS: Record<ElectionStatus, { label: string; className: string }> = {
  DRAFT: { label: 'Draft', className: 'b-draft' },
  OPEN: { label: 'Open', className: 'b-open' },
  CLOSED: { label: 'Closed', className: 'b-closed' },
  PUBLISHED: { label: 'Published', className: 'b-published' },
}

export function statusBadge(status: ElectionStatus): string {
  // The API could grow a status this file has not heard of yet. A badge is not
  // worth a blank page over, so an unknown one is shown as-is.
  const meta = STATUS_LABELS[status] ?? { label: String(status), className: 'b-draft' }
  return `<span class="badge ${meta.className}">${esc(meta.label)}</span>`
}

const AVATAR_HUES = [174, 152, 205, 24, 340, 96, 36, 262]

export function avatar(name: string, photoUrl: string | null = null, size = 40): string {
  if (photoUrl) {
    return `<img class="avatar" src="${esc(photoUrl)}" alt="${esc(name)}" width="${size}" height="${size}">`
  }
  const initials = name.split(/\s+/).map((word) => word[0] ?? '').slice(0, 2).join('').toUpperCase()
  let hash = 0
  for (const char of name) hash = (hash * 31 + char.charCodeAt(0)) | 0
  const hue = AVATAR_HUES[Math.abs(hash) % AVATAR_HUES.length]
  return `<span class="avatar" style="width:${size}px;height:${size}px;background:hsl(${hue} 65% 45%);font-size:${Math.round(size * 0.38)}px">${esc(initials)}</span>`
}

export function banner(kind: 'info' | 'success' | 'warn' | 'error', message: string): string {
  const iconName = kind === 'success' ? 'check' : kind === 'error' ? 'x' : 'alert'
  // A banner that appears after a failed check must be spoken, not just seen.
  const role = kind === 'error' ? 'alert' : 'status'
  return `<div class="banner banner-${kind}" role="${role}">${icon(iconName, 18)}<span>${esc(message)}</span></div>`
}

export function pageHead(title: string, subtitle = '', actions = ''): string {
  return `<div class="page-head">
    <div>
      <h1>${esc(title)}</h1>
      ${subtitle ? `<p class="page-sub">${esc(subtitle)}</p>` : ''}
    </div>
    ${actions ? `<div class="page-actions">${actions}</div>` : ''}
  </div>`
}

export function field(label: string, inputHtml: string, hint = ''): string {
  return `<label class="field">
    <span class="field-label">${esc(label)}</span>
    ${inputHtml}
    ${hint ? `<span class="field-hint">${esc(hint)}</span>` : ''}
  </label>`
}

export function statCard(label: string, value: string, iconName: string): string {
  return `<div class="stat card">
    <span class="stat-icon">${icon(iconName, 20)}</span>
    <div>
      <span class="stat-value">${esc(value)}</span>
      <span class="stat-label">${esc(label)}</span>
    </div>
  </div>`
}

export function emptyState(iconName: string, title: string, message: string): string {
  return `<div class="empty">
    <span class="empty-icon">${icon(iconName, 32)}</span>
    <h3>${esc(title)}</h3>
    <p>${esc(message)}</p>
  </div>`
}

/** The grey shimmering lines shown while a page is still waiting on the API. */
export function loadingHtml(lines = 4): string {
  let html = '<div class="skeleton" aria-hidden="true">'
  for (let i = 0; i < lines; i++) {
    html += `<div class="skeleton-line"${i === lines - 1 ? ' style="width:55%"' : ''}></div>`
  }
  return html + '</div>'
}

/** Shown when a request failed. The button is wired up by main.ts. */
export function errorHtml(message: string): string {
  return `${pageHead('Something went wrong')}
  ${banner('error', message)}
  <button class="btn ghost" type="button" data-retry>${icon('clock', 15)} Try again</button>`
}

// --------------------------------------------------------------- live helpers

/** Dims a button and stops it firing twice while its request is in flight. */
/** Icons lifted out of a button while it is busy, so restoring the label puts them back. */
const savedIcons = new WeakMap<HTMLButtonElement, Node>()

export function setBusy(button: HTMLButtonElement, busy: boolean, busyLabel = 'Working…'): void {
  if (busy) {
    button.dataset.label = button.textContent ?? ''
    // Writing textContent replaces every child, which would destroy the icon
    // sitting next to the words. Lift it out and reattach it on the way back.
    const icon = button.querySelector('svg')
    if (icon) {
      savedIcons.set(button, icon)
      icon.remove()
    }
    button.textContent = busyLabel
    button.disabled = true
    button.setAttribute('aria-busy', 'true')
  } else {
    button.textContent = button.dataset.label ?? button.textContent
    delete button.dataset.label
    const icon = savedIcons.get(button)
    if (icon) {
      button.prepend(icon)
      savedIcons.delete(button)
    }
    button.disabled = false
    button.removeAttribute('aria-busy')
  }
}

/** A short message that slides in at the bottom, then disappears. */
export function toast(message: string, kind: 'info' | 'success' | 'error' = 'info'): void {
  document.querySelector('.toast')?.remove()
  const iconName = kind === 'success' ? 'check' : kind === 'error' ? 'x' : 'alert'
  const el = document.createElement('div')
  el.className = `toast toast-${kind}`
  // The toast is added to the page after the fact, which is exactly what a live
  // region is for: a screen reader speaks it without the user losing their place.
  el.setAttribute('role', kind === 'error' ? 'alert' : 'status')
  el.setAttribute('aria-live', kind === 'error' ? 'assertive' : 'polite')
  el.innerHTML = `${icon(iconName, 16)}<span>${esc(message)}</span>`
  document.body.append(el)
  requestAnimationFrame(() => el.classList.add('show'))
  setTimeout(() => {
    el.classList.remove('show')
    setTimeout(() => el.remove(), 300)
  }, 3200)
}

export async function copyText(text: string): Promise<void> {
  try {
    await navigator.clipboard.writeText(text)
    toast('Copied to clipboard', 'success')
  } catch {
    toast('Could not access clipboard', 'error')
  }
}
