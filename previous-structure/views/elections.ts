import type { Election, ElectionDetail, ElectionStatus, User } from '../types'
import type { Route } from '../router'
import { nav } from '../router'
import { getElectionDetail, listElections } from '../services'
import {
  asyncView,
  avatar,
  banner,
  emptyState,
  field,
  fmtDate,
  h,
  icon,
  pageHead,
  setBusy,
  statusBadge,
  textInput,
  windowLabel,
} from '../ui'

// ------------------------------------------------------------- list view

type Filter = 'ALL' | ElectionStatus

export function renderElections(_route: Route, user: User): HTMLElement {
  let filter: Filter = 'ALL'
  let all: Election[] = []
  const listEl = h('div', {})

  const chipLabel = (f: Filter): string =>
    f === 'ALL' ? 'All elections' : f === 'OPEN' ? 'Open' : f === 'CLOSED' ? 'Closed' : 'Published'

  const chips = h('div', { class: 'chips' },
    ...(['ALL', 'OPEN', 'CLOSED', 'PUBLISHED'] as const).map((f) =>
      h('button', {
        class: `chip ${f === filter ? 'active' : ''}`,
        type: 'button',
        onClick: (e: Event) => {
          filter = f
          chips.querySelectorAll('.chip').forEach((c) => c.classList.remove('active'))
          ;(e.currentTarget as HTMLElement).classList.add('active')
          drawList()
        },
      }, chipLabel(f)),
    ),
  )

  function drawList(): void {
    const visible = filter === 'ALL' ? all : all.filter((e) => e.status === filter)
    listEl.replaceChildren(
      visible.length
        ? h('div', { class: 'election-grid' }, ...visible.map((e) => electionCard(e, user)))
        : emptyState('box', 'Nothing here', 'No elections match this filter yet.'),
    )
  }

  return asyncView(async () => {
    all = await listElections()
    drawList()
    return h('div', {},
      pageHead(
        user.role === 'ADMIN' ? 'All elections' : 'Elections',
        user.role === 'ADMIN'
          ? 'Every election in the system, including drafts.'
          : 'Browse open elections and published results.',
      ),
      chips,
      listEl,
    )
  })
}

function electionCard(e: Election, user: User): HTMLElement {
  return h('article', { class: 'card election-card', onClick: () => nav(`/elections/${e.id}`) },
    h('div', { class: 'election-card-top' }, statusBadge(e.status)),
    h('h3', { class: 'election-title', text: e.title }),
    h('p', { class: 'election-desc', text: e.description ?? '' }),
    h('div', { class: 'election-meta' },
      h('span', {}, icon('calendar', 15), ` ${fmtDate(e.startsAt)} — ${fmtDate(e.endsAt)}`),
      h('span', {}, icon('flag', 15), ` ${positionCountLabel(e)}`),
    ),
    e.status === 'OPEN' ? h('span', { class: 'countdown', text: windowLabel(e.endsAt, 'end') }) : undefined,
    h('span', { class: 'card-cta' }, `${user.role === 'ADMIN' && e.status === 'DRAFT' ? 'Manage' : 'View'} `, icon('arrowRight', 15)),
  )
}

/** The list endpoint does not include positions, so the count only appears on detail pages. */
function positionCountLabel(e: Election): string {
  return e.status === 'DRAFT' ? 'Being configured' : 'Election'
}

// ----------------------------------------------------------- detail view

export function renderElectionDetail(route: Route, user: User): HTMLElement {
  const id = route.parts[1] ?? ''
  return asyncView(async () => {
    const detail = await getElectionDetail(id)
    if (!detail) {
      return h('div', {},
        pageHead('Election not found'),
        banner('error', 'This election does not exist or is not visible to your account.'),
        h('a', { class: 'btn ghost', href: '#/elections' }, icon('arrowLeft', 15), ' Back to elections'),
      )
    }
    return h('div', {},
      h('a', { class: 'back-link', href: '#/elections' }, icon('arrowLeft', 15), ' All elections'),
      detailHeader(detail, user),
      viewerBanner(detail, user),
      h('h2', { class: 'section-title', text: `Positions (${detail.positions.length})` }),
      detail.positions.length
        ? h('div', { class: 'position-list' }, ...detail.positions.map((p) => positionCard(p)))
        : emptyState('box', 'No positions yet', 'The election administrator has not added any positions.'),
    )
  })
}

function detailHeader(detail: ElectionDetail, user: User): HTMLElement {
  const actions: HTMLElement[] = []
  if (user.role === 'ADMIN') {
    actions.push(h('a', { class: 'btn ghost', href: `#/admin/elections/${detail.id}` }, icon('edit', 15), ' Manage'))
  }
  const { isEligible, hasVoted } = detail.viewerStatus
  if (detail.status === 'OPEN' && isEligible && !hasVoted) {
    actions.push(h('a', { class: 'btn primary', href: `#/elections/${detail.id}/ballot` }, icon('box', 15), ' Vote now'))
  } else if (detail.status === 'PUBLISHED') {
    actions.push(h('a', { class: 'btn primary', href: `#/elections/${detail.id}/results` }, icon('chart', 15), ' View results'))
  }
  return h('header', { class: 'detail-header card' },
    h('div', {},
      h('div', { class: 'election-card-top' },
        statusBadge(detail.status),
        h('span', { class: 'muted', text: windowLabel(detail.endsAt, 'end') }),
      ),
      h('h1', { text: detail.title }),
      detail.description ? h('p', { class: 'muted', text: detail.description }) : undefined,
      h('div', { class: 'election-meta' },
        h('span', {}, icon('calendar', 15), ` Opens ${fmtDate(detail.startsAt)}`),
        h('span', {}, icon('calendar', 15), ` Closes ${fmtDate(detail.endsAt)}`),
        h('span', {}, icon('users', 15), ` ${detail.positions.length} position${detail.positions.length === 1 ? '' : 's'}`),
      ),
    ),
    actions.length ? h('div', { class: 'page-actions' }, ...actions) : undefined,
  )
}

function viewerBanner(detail: ElectionDetail, user: User): HTMLElement {
  const { isEligible, hasVoted } = detail.viewerStatus
  if (detail.status === 'OPEN') {
    if (hasVoted) {
      return banner('success', 'Your ballot has been cast in this election. Keep your receipt code safe — it is the only proof of participation, and it never reveals your choices.')
    }
    if (!isEligible) {
      return banner('warn', 'You are not on the voter roll for this election. Contact the election administrator if you believe this is a mistake.')
    }
    return banner('info', 'You are on the voter roll. Your vote is secret — choices are stored anonymously and cannot be traced back to you.')
  }
  if (detail.status === 'CLOSED') {
    return user.role === 'ADMIN'
      ? banner('info', 'Voting has closed. Preliminary results are available to administrators only until the election is published.')
      : banner('info', 'Voting has closed. Results will be visible once the administrator publishes them.')
  }
  if (detail.status === 'PUBLISHED') {
    return banner('success', 'Results for this election have been published and are available to everyone.')
  }
  return banner('info', 'This election is still being configured.')
}

function positionCard(position: ElectionDetail['positions'][number]): HTMLElement {
  return h('section', { class: 'card position-card' },
    h('div', { class: 'position-head' },
      h('h3', { text: position.title }),
      h('span', { class: 'pill', text: position.seats === 1 ? '1 seat' : `${position.seats} seats` }),
      h('span', { class: 'pill pill-muted', text: `${position.candidates.length} candidate${position.candidates.length === 1 ? '' : 's'}` }),
    ),
    h('div', { class: 'candidate-grid' },
      ...position.candidates.map((c) =>
        h('article', { class: 'candidate' },
          avatar(c.fullName, c.photoUrl, 44),
          h('div', { class: 'candidate-body' },
            h('h4', { text: c.fullName }),
            c.manifesto
              ? h('details', { class: 'manifesto' }, h('summary', { text: 'Read manifesto' }), h('p', { text: c.manifesto }))
              : h('span', { class: 'muted sm-text', text: 'No manifesto provided' }),
          ),
        ),
      ),
    ),
  )
}

// ------------------------------------------------- admin: shared election form

export interface ElectionFormValues {
  title: string
  description: string | null
  startsAt: string
  endsAt: string
}

export function electionForm(
  values: ElectionFormValues,
  onSubmit: (v: ElectionFormValues) => Promise<void> | void,
  submitLabel: string,
): HTMLElement {
  const title = textInput({ value: values.title, placeholder: 'e.g. 2026/2027 Student Union Government Elections' })
  const description = h('textarea', { class: 'input', rows: '3', placeholder: 'What is this election about?' }) as HTMLTextAreaElement
  description.value = values.description ?? ''
  const startsAt = h('input', { class: 'input', type: 'datetime-local', value: values.startsAt }) as HTMLInputElement
  const endsAt = h('input', { class: 'input', type: 'datetime-local', value: values.endsAt }) as HTMLInputElement
  const error = h('p', { class: 'form-error', style: 'display:none' })
  const submitBtn = h('button', { class: 'btn primary', type: 'submit' }, submitLabel) as HTMLButtonElement

  const form = h('form', { class: 'stack-form', novalidate: 'novalidate' },
    field('Election title', title),
    field('Description', description),
    h('div', { class: 'form-row' },
      field('Voting opens', startsAt),
      field('Voting closes', endsAt),
    ),
    error,
    submitBtn,
  )

  let busy = false

  form.addEventListener('submit', (e) => {
    e.preventDefault()
    if (busy) return
    if (!title.value.trim()) return fail('A title is required.')
    if (title.value.trim().length < 3) return fail('The title needs at least 3 characters.')
    if (!startsAt.value || !endsAt.value) return fail('Both dates are required.')
    if (new Date(endsAt.value).getTime() <= new Date(startsAt.value).getTime()) return fail('Closing time must be after opening time.')

    busy = true
    setBusy(submitBtn, true, 'Saving…')
    void Promise.resolve(
      onSubmit({
        title: title.value.trim(),
        description: description.value.trim() || null,
        startsAt: startsAt.value,
        endsAt: endsAt.value,
      }),
    ).then(
      () => {
        busy = false
        setBusy(submitBtn, false)
      },
      (err: unknown) => {
        busy = false
        setBusy(submitBtn, false)
        fail(err instanceof Error && err.message ? err.message : 'The server rejected this request.')
      },
    )
  })

  function fail(message: string): void {
    error.textContent = message
    error.style.display = 'block'
  }
  return form
}
