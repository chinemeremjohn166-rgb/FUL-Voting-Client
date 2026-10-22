// The administrator's dashboard: every election at a glance, grouped by where
// it is in its life (draft, open, closed, published).

import { getElections } from '../api'
import { Election, ElectionStatus, Page } from '../types'
import { emptyState, esc, formatDate, icon, pageHead, statCard, statusBadge } from '../ui'
import { bindElectionDeletes, bindTransitions, deleteElectionButtonHtml, previewResultsButtonHtml, transitionButtonHtml } from './admin-common'
import { reloadPage } from './election-form'

const GROUPS: ElectionStatus[] = ['DRAFT', 'OPEN', 'CLOSED', 'PUBLISHED']

export function adminPage(): Page {
  let elections: Election[] = []

  /** Counts are read off the list we already fetched — no extra request needed. */
  function count(status: ElectionStatus): number {
    return elections.filter((e) => e.status === status).length
  }

  return {
    title: 'Administration',

    async render() {
      elections = await getElections()
      const groups = GROUPS.map((status) => ({ status, items: elections.filter((e) => e.status === status) })).filter((group) => group.items.length > 0)

      return `${pageHead(
        'Election administration',
        'Create elections, build ballots, manage voter rolls and publish results.',
        '<a class="btn primary" href="#/admin/new">' + icon('plus', 15) + ' New election</a>',
      )}
      <div class="stat-grid">
        ${statCard('Total elections', String(elections.length), 'box')}
        ${statCard('Drafts', String(count('DRAFT')), 'edit')}
        ${statCard('Open', String(count('OPEN')), 'clock')}
        ${statCard('Published', String(count('PUBLISHED')), 'flag')}
      </div>
      ${groups.length
        ? groups.map(groupHtml).join('')
        : emptyState('box', 'No elections yet', 'Create the first draft election to get started.')}`
    },

    bind(root) {
      bindTransitions(root)
      // A deleted election simply disappears from the list when it is fetched again.
      bindElectionDeletes(root, reloadPage)
    },
  }
}

function groupHtml(group: { status: ElectionStatus; items: Election[] }): string {
  return `<section class="admin-group">
    <h2 class="section-title">${statusBadge(group.status)} ${group.items.length}</h2>
    <div class="election-grid">${group.items.map(cardHtml).join('')}</div>
  </section>`
}

function cardHtml(election: Election): string {
  const actions = [
    `<a class="btn ghost sm" href="#/admin/elections/${esc(election.id)}">${icon('edit', 15)} Manage</a>`,
    transitionButtonHtml(election),
    previewResultsButtonHtml(election),
    deleteElectionButtonHtml(election),
  ].join('')

  return `<article class="card election-card">
    <div class="election-card-top">${statusBadge(election.status)}</div>
    <h3 class="election-title">${esc(election.title)}</h3>
    <div class="election-meta">
      <span>${icon('calendar', 15)} ${formatDate(election.startsAt)} — ${formatDate(election.endsAt)}</span>
    </div>
    <div class="admin-card-actions">${actions}</div>
  </article>`
}
