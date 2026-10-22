import type { PositionResult, User } from '../types'
import type { Route } from '../router'
import { getElectionDetail, getResults } from '../services'
import {
  asyncView,
  avatar,
  banner,
  emptyState,
  fmtDateTime,
  h,
  icon,
  pageHead,
  statCard,
  statusBadge,
} from '../ui'

/**
 * Honours the API's access rules: DRAFT/OPEN → nobody; CLOSED → admins only;
 * PUBLISHED → every signed-in user.
 */
export async function buildResultsView(electionId: string, user: User): Promise<HTMLElement> {
  const detail = await getElectionDetail(electionId)
  if (!detail) {
    return h('div', {},
      pageHead('Election not found'),
      banner('error', 'No election matches this link, or it is hidden from your account.'),
    )
  }

  if (detail.status === 'DRAFT' || detail.status === 'OPEN') {
    return h('div', {},
      pageHead('Results sealed'),
      banner('info', 'Tallies are hidden while an election is running — nobody, including administrators, can see them. This prevents interference.'),
      h('a', { class: 'btn ghost', href: `#/elections/${electionId}` }, icon('arrowLeft', 15), ' Back to election'),
    )
  }

  if (detail.status === 'CLOSED' && user.role !== 'ADMIN') {
    return h('div', {},
      pageHead('Awaiting publication'),
      banner('info', 'Voting has closed but results have not been published yet. Check back once the administrator publishes them.'),
      h('a', { class: 'btn ghost', href: `#/elections/${electionId}` }, icon('arrowLeft', 15), ' Back to election'),
    )
  }

  const results = await getResults(electionId)

  const blocks: HTMLElement[] = []
  if (detail.status === 'CLOSED') {
    blocks.push(banner('warn', 'Preliminary results — visible to administrators only. Publishing the election makes them public.'))
  }

  return h('div', {},
    ...blocks,
    h('a', { class: 'back-link', href: `#/elections/${electionId}` }, icon('arrowLeft', 15), ' Election'),
    pageHead(
      results.election.title,
      undefined,
      statusBadge(results.election.status),
    ),
    results.election.publishedAt
      ? h('p', { class: 'muted', text: `Published ${fmtDateTime(results.election.publishedAt)}` })
      : undefined,
    h('div', { class: 'stat-grid' },
      statCard('Registered voters', String(results.turnout.registeredVoters), 'users'),
      statCard('Ballots cast', String(results.turnout.ballotsCast), 'box'),
      statCard('Turnout', results.turnout.turnoutPercentage, 'chart'),
    ),
    results.results.length
      ? h('div', { class: 'results-list' }, ...results.results.map((r) => positionResultCard(r)))
      : emptyState('chart', 'No positions recorded', 'This election has no positions to tally.'),
  )
}

export function renderResults(route: Route, user: User): HTMLElement {
  const electionId = route.parts[1] ?? ''
  return asyncView(() => buildResultsView(electionId, user), 5)
}

function positionResultCard(result: PositionResult): HTMLElement {
  const maxVotes = Math.max(1, ...result.candidates.map((c) => c.voteCount))
  return h('section', { class: 'card result-card' },
    h('div', { class: 'position-head' },
      h('h3', { text: result.title }),
      h('span', { class: 'pill', text: result.seats === 1 ? '1 seat' : `${result.seats} seats` }),
      h('span', { class: 'pill pill-muted', text: `${result.totalVotes} vote${result.totalVotes === 1 ? '' : 's'}` }),
    ),
    result.hasTie
      ? banner('warn', 'Tie detected at the seat boundary. Administrators must adjudicate before winners are finalised.')
      : undefined,
    h('div', { class: 'result-rows' },
      ...result.candidates.map((c) => {
        const isWinner = result.winners.some((w) => w.id === c.id)
        return h('div', { class: `result-row ${isWinner ? 'winner' : ''}` },
          avatar(c.fullName, c.photoUrl, 36),
          h('div', { class: 'result-main' },
            h('div', { class: 'result-name-line' },
              h('strong', { text: c.fullName }),
              isWinner ? h('span', { class: 'winner-badge' }, icon('award', 14), ' Winner') : undefined,
            ),
            h('div', { class: 'bar-track' },
              h('div', { class: 'bar-fill', style: `width:${Math.max(2, (c.voteCount / maxVotes) * 100)}%` }),
            ),
          ),
          h('div', { class: 'result-numbers' },
            h('strong', { text: c.percentage }),
            h('span', { class: 'muted sm-text', text: `${c.voteCount} vote${c.voteCount === 1 ? '' : 's'}` }),
          ),
        )
      }),
    ),
    result.blankVotes > 0
      ? h('p', { class: 'muted sm-text blank-note' }, `${result.blankVotes} blank/abstained vote${result.blankVotes === 1 ? '' : 's'} (not attributed to any candidate)`)
      : undefined,
  )
}
