// Results, and the rules about who may see them:
//   DRAFT or OPEN  -> nobody (not even an admin), while voting could be swayed
//   CLOSED         -> admins only, marked preliminary
//   PUBLISHED      -> everyone signed in

import { getElection, getResults } from '../api'
import { getUser } from '../session'
import { ElectionDetail, Page, PositionResult } from '../types'
import { avatar, banner, emptyState, esc, formatDateTime, icon, pageHead, statCard, statusBadge } from '../ui'

/**
 * `knownDetail` lets a page that already loaded this election reuse it instead
 * of asking the API for the same election a second time.
 */
export async function resultsHtml(electionId: string, knownDetail?: ElectionDetail | null): Promise<string> {
  const user = getUser()
  const detail = knownDetail ?? (await getElection(electionId))

  if (!detail) {
    return `${pageHead('Election not found')}
      ${banner('error', 'No election matches this link, or it is hidden from your account.')}`
  }

  if (detail.status === 'DRAFT' || detail.status === 'OPEN') {
    return `${pageHead('Results sealed')}
      ${banner('info', 'Tallies are hidden while an election is running — nobody, including administrators, can see them. This prevents interference.')}
      <a class="btn ghost" href="#/elections/${esc(electionId)}">${icon('arrowLeft', 15)} Back to election</a>`
  }

  if (detail.status === 'CLOSED' && user?.role !== 'ADMIN') {
    return `${pageHead('Awaiting publication')}
      ${banner('info', 'Voting has closed but results have not been published yet. Check back once the administrator publishes them.')}
      <a class="btn ghost" href="#/elections/${esc(electionId)}">${icon('arrowLeft', 15)} Back to election</a>`
  }

  const results = await getResults(electionId)

  return `${detail.status === 'CLOSED'
      ? banner('warn', 'Preliminary results — visible to administrators only. Publishing the election makes them public.')
      : ''}
    <a class="back-link" href="#/elections/${esc(electionId)}">${icon('arrowLeft', 15)} Election</a>
    ${pageHead(results.election.title, '', statusBadge(results.election.status))}
    ${results.election.publishedAt ? `<p class="muted">Published ${formatDateTime(results.election.publishedAt)}</p>` : ''}
    <div class="stat-grid">
      ${statCard('Registered voters', String(results.turnout.registeredVoters), 'users')}
      ${statCard('Ballots cast', String(results.turnout.ballotsCast), 'box')}
      ${statCard('Turnout', results.turnout.turnoutPercentage, 'chart')}
    </div>
    ${results.results.length
      ? `<div class="results-list">${results.results.map(positionResultHtml).join('')}</div>`
      : emptyState('chart', 'No positions recorded', 'This election has no positions to tally.')}`
}

export function resultsPage(electionId: string): Page {
  return {
    title: 'Results',
    render: () => resultsHtml(electionId),
  }
}

function positionResultHtml(result: PositionResult): string {
  const biggest = Math.max(1, ...result.candidates.map((candidate) => candidate.voteCount))

  const rows = result.candidates.map((candidate) => {
    const winner = result.winners.some((item) => item.id === candidate.id)
    const width = Math.max(2, (candidate.voteCount / biggest) * 100)
    // The API still fills the seats with the top count, but when `hasTie` says
    // the last seat is contested nobody has actually won it yet.
    const badge = !winner ? '' : result.hasTie
      ? '<span class="winner-badge">Tied</span>'
      : `<span class="winner-badge">${icon('award', 14)} Winner</span>`
    return `<div class="result-row ${winner ? 'winner' : ''}">
      ${avatar(candidate.fullName, candidate.photoUrl, 36)}
      <div class="result-main">
        <div class="result-name-line">
          <strong>${esc(candidate.fullName)}</strong>
          ${badge}
        </div>
        <div class="bar-track"><div class="bar-fill" style="width:${width}%"></div></div>
      </div>
      <div class="result-numbers">
        <strong>${esc(candidate.percentage)}</strong>
        <span class="muted sm-text">${candidate.voteCount} vote${candidate.voteCount === 1 ? '' : 's'}</span>
      </div>
    </div>`
  }).join('')

  return `<section class="card result-card">
    <div class="position-head">
      <h3>${esc(result.title)}</h3>
      <span class="pill">${result.seats === 1 ? '1 seat' : `${result.seats} seats`}</span>
      <span class="pill pill-muted">${result.totalVotes} vote${result.totalVotes === 1 ? '' : 's'}</span>
    </div>
    ${result.hasTie ? banner('warn', 'Tie detected at the seat boundary. Administrators must adjudicate before winners are finalised.') : ''}
    <div class="result-rows">${rows}</div>
    ${result.blankVotes > 0
      ? `<p class="muted sm-text blank-note">${result.blankVotes} blank/abstained vote${result.blankVotes === 1 ? '' : 's'} (not attributed to any candidate)</p>`
      : ''}
  </section>`
}
