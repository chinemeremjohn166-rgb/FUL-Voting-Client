// The list of elections, with filter buttons across the top.

import { getElections } from '../api'
import { getUser } from '../session'
import { Election, Page } from '../types'
import { emptyState, esc, formatDate, icon, statusBadge, windowLabel } from '../ui'

const FILTERS = [
  { value: 'ALL', label: 'All elections' },
  { value: 'OPEN', label: 'Open' },
  { value: 'CLOSED', label: 'Closed' },
  { value: 'PUBLISHED', label: 'Published' },
]

export function electionsPage(): Page {
  // Remembered between the filter clicks so we do not fetch the list again.
  let all: Election[] = []

  return {
    title: 'Elections',

    async render() {
      all = await getElections()
      const user = getUser()
      const isAdmin = user?.role === 'ADMIN'

      const activeFilters = isAdmin
        ? [
            { value: 'ALL', label: 'All elections' },
            { value: 'DRAFT', label: 'Drafts' },
            { value: 'OPEN', label: 'Open' },
            { value: 'CLOSED', label: 'Closed' },
            { value: 'PUBLISHED', label: 'Published' },
          ]
        : FILTERS

      const chips = activeFilters.map(
        (filter) => `<button type="button" class="chip ${filter.value === 'ALL' ? 'active' : ''}" data-filter="${esc(filter.value)}">${esc(filter.label)}</button>`,
      ).join('')

      return `${pageHeaderHtml(isAdmin)}
        <div class="chips">${chips}</div>
        <div data-list>${cardsHtml(all, isAdmin)}</div>`
    },

    bind(root) {
      const list = root.querySelector('[data-list]')
      if (!list) return

      root.querySelectorAll('[data-filter]').forEach((chip) => {
        chip.addEventListener('click', () => {
          const wanted = chip.getAttribute('data-filter') ?? 'ALL'
          root.querySelectorAll('.chip').forEach((other) => other.classList.remove('active'))
          chip.classList.add('active')
          const visible = wanted === 'ALL' ? all : all.filter((election) => election.status === wanted)
          list.innerHTML = cardsHtml(visible, getUser()?.role === 'ADMIN')
        })
      })
    },
  }
}

function pageHeaderHtml(isAdmin: boolean): string {
  if (isAdmin) {
    return `<div class="page-head"><div>
      <h1>All elections</h1>
      <p class="page-sub">Every election in the system, including drafts.</p>
    </div></div>`
  }
  return `<div class="page-head"><div>
    <h1>Elections</h1>
    <p class="page-sub">Browse open elections and published results.</p>
  </div></div>`
}

function cardsHtml(elections: Election[], isAdmin: boolean): string {
  if (elections.length === 0) {
    return emptyState('box', 'Nothing here', 'No elections match this filter yet.')
  }
  return `<div class="election-grid">${elections.map((election) => cardHtml(election, isAdmin)).join('')}</div>`
}

function cardHtml(election: Election, isAdmin: boolean): string {
  const managing = isAdmin && election.status === 'DRAFT'
  const href = managing ? `#/admin/elections/${esc(election.id)}` : `#/elections/${esc(election.id)}`
  return `<a class="card election-card" href="${href}">
    <div class="election-card-top">${statusBadge(election.status)}</div>
    <h3 class="election-title">${esc(election.title)}</h3>
    <p class="election-desc">${esc(election.description)}</p>
    <div class="election-meta">
      <span>${icon('calendar', 15)} ${formatDate(election.startsAt)} — ${formatDate(election.endsAt)}</span>
      <span>${icon('flag', 15)} ${election.status === 'DRAFT' ? 'Being configured' : 'Election'}</span>
    </div>
    ${election.status === 'OPEN' ? `<span class="countdown">${windowLabel(election.endsAt, 'end')}</span>` : ''}
    <span class="card-cta">${managing ? 'Manage' : 'View'} ${icon('arrowRight', 15)}</span>
  </a>`
}
