// One election: what it is for, who can vote in it, and the positions on its ballot.

import { getElection } from '../api'
import { getUser } from '../session'
import { ElectionDetail, Page, Position } from '../types'
import { avatar, banner, emptyState, esc, formatDate, formatDateTime, icon, statusBadge, windowLabel, windowState } from '../ui'

export function electionPage(electionId: string): Page {
  return {
    title: 'Election',

    async render() {
      const detail = await getElection(electionId)
      if (!detail) {
        return `<div class="page-head"><h1>Election not found</h1></div>
          ${banner('error', 'This election does not exist or is not visible to your account.')}
          <a class="btn ghost" href="#/elections">${icon('arrowLeft', 15)} Back to elections</a>`
      }

      const positions = detail.positions
      return `<a class="back-link" href="#/elections">${icon('arrowLeft', 15)} All elections</a>
        ${headerHtml(detail)}
        ${viewerBanner(detail)}
        <h2 class="section-title">Positions (${positions.length})</h2>
        ${positions.length
          ? `<div class="position-list">${positions.map(positionHtml).join('')}</div>`
          : emptyState('box', 'No positions yet', 'The election administrator has not added any positions.')}`
    },
  }
}

function headerHtml(detail: ElectionDetail): string {
  const isAdmin = getUser()?.role === 'ADMIN'
  const { isEligible, hasVoted } = detail.viewerStatus
  // The server only accepts a ballot inside the voting window, so the button to
  // start one appears only then — an OPEN election can still be waiting for its
  // starting time.
  const voting = windowState(detail.startsAt, detail.endsAt)

  let actions = ''
  if (isAdmin) {
    actions += `<a class="btn ghost" href="#/admin/elections/${esc(detail.id)}">${icon('edit', 15)} Manage</a>`
  }
  if (detail.status === 'OPEN' && voting === 'live' && isEligible && !hasVoted) {
    actions += `<a class="btn primary" href="#/elections/${esc(detail.id)}/ballot">${icon('box', 15)} Vote now</a>`
  } else if (detail.status === 'PUBLISHED') {
    actions += `<a class="btn primary" href="#/elections/${esc(detail.id)}/results">${icon('chart', 15)} View results</a>`
  }

  return `<header class="detail-header card">
    <div>
      <div class="election-card-top">
        ${statusBadge(detail.status)}
        <span class="muted">${voting === 'pending' ? windowLabel(detail.startsAt, 'start') : windowLabel(detail.endsAt, 'end')}</span>
      </div>
      <h1>${esc(detail.title)}</h1>
      ${detail.description ? `<p class="muted">${esc(detail.description)}</p>` : ''}
      <div class="election-meta">
        <span>${icon('calendar', 15)} Opens ${formatDate(detail.startsAt)}</span>
        <span>${icon('calendar', 15)} Closes ${formatDate(detail.endsAt)}</span>
        <span>${icon('users', 15)} ${detail.positions.length} position${detail.positions.length === 1 ? '' : 's'}</span>
      </div>
    </div>
    ${actions ? `<div class="page-actions">${actions}</div>` : ''}
  </header>`
}

/** Explains, in plain words, what this person can still do in this election. */
function viewerBanner(detail: ElectionDetail): string {
  const isAdmin = getUser()?.role === 'ADMIN'
  const { isEligible, hasVoted } = detail.viewerStatus

  if (detail.status === 'OPEN') {
    if (hasVoted) {
      return banner('success', 'Your ballot has been cast in this election. Keep your receipt code safe — it is the only proof of participation, and it never reveals your choices.')
    }
    if (!isEligible) {
      return banner('warn', 'You are not on the voter roll for this election. Contact the election administrator if you believe this is a mistake.')
    }
    // Being on the roll is not enough: the server rejects a ballot cast outside
    // the opening and closing times, even while the status still reads OPEN.
    const voting = windowState(detail.startsAt, detail.endsAt)
    if (voting === 'pending') {
      return banner('info', `You are on the voter roll. Voting opens ${formatDateTime(detail.startsAt)} — the ballot will be ready then.`)
    }
    if (voting === 'ended') {
      return banner('warn', `The voting window for this election ended ${formatDateTime(detail.endsAt)}, so no further ballots are accepted.`)
    }
    return banner('info', 'You are on the voter roll. Your vote is secret — choices are stored anonymously and cannot be traced back to you.')
  }
  if (detail.status === 'CLOSED') {
    return isAdmin
      ? banner('info', 'Voting has closed. Preliminary results are available to administrators only until the election is published.')
      : banner('info', 'Voting has closed. Results will be visible once the administrator publishes them.')
  }
  if (detail.status === 'PUBLISHED') {
    return banner('success', 'Results for this election have been published and are available to everyone.')
  }
  return banner('info', 'This election is still being configured.')
}

function positionHtml(position: Position): string {
  const candidates = position.candidates.map((candidate) => `<article class="candidate">
      ${avatar(candidate.fullName, candidate.photoUrl, 44)}
      <div class="candidate-body">
        <h4>${esc(candidate.fullName)}</h4>
        ${candidate.manifesto
          ? `<details class="manifesto"><summary>Read manifesto</summary><p>${esc(candidate.manifesto)}</p></details>`
          : '<span class="muted sm-text">No manifesto provided</span>'}
      </div>
    </article>`).join('')

  return `<section class="card position-card">
    <div class="position-head">
      <h3>${esc(position.title)}</h3>
      <span class="pill">${position.seats === 1 ? '1 seat' : `${position.seats} seats`}</span>
      <span class="pill pill-muted">${position.candidates.length} candidate${position.candidates.length === 1 ? '' : 's'}</span>
    </div>
    <div class="candidate-grid">${candidates}</div>
  </section>`
}
