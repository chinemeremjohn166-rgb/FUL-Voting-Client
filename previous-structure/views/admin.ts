import type { Election, ElectionDetail, ElectionStatus, RollEntry, User } from '../types'
import type { Route } from '../router'
import { nav } from '../router'
import {
  addCandidate,
  addPosition,
  addToRoll,
  createElection,
  deleteCandidate,
  deleteElection,
  deletePosition,
  getElectionDetail,
  listElections,
  listRoll,
  removeFromRoll,
  transitionElection,
  updateElection,
} from '../services'
import {
  asyncView,
  avatar,
  banner,
  confirmModal,
  emptyState,
  field,
  fmtDate,
  fromLocalInput,
  h,
  icon,
  pageHead,
  setBusy,
  statCard,
  statusBadge,
  textInput,
  toLocalInput,
  toast,
} from '../ui'
import { electionForm } from './elections'
import { buildResultsView } from './results'

const NEXT_STATUS: Partial<Record<ElectionStatus, ElectionStatus>> = {
  DRAFT: 'OPEN',
  OPEN: 'CLOSED',
  CLOSED: 'PUBLISHED',
}

const TRANSITION_META: Record<ElectionStatus, { label: string; className: string; confirm: string } | null> = {
  DRAFT: {
    label: 'Open voting',
    className: 'primary',
    confirm: 'Once open, the ballot, positions, candidates and voter roll become immutable.',
  },
  OPEN: {
    label: 'Close voting',
    className: 'danger',
    confirm: 'Closing ends voting immediately. Ballots already cast remain counted.',
  },
  CLOSED: {
    label: 'Publish results',
    className: 'primary',
    confirm: 'Published results become visible to every user. This transition is final.',
  },
  PUBLISHED: null,
}

function serverMessage(err: unknown): string {
  return err instanceof Error && err.message ? err.message : 'The server rejected this request.'
}

/** Re-runs the current route, which re-fetches from the API behind a skeleton. */
function refreshRoute(): void {
  window.dispatchEvent(new HashChangeEvent('hashchange'))
}

function runAction(btn: HTMLButtonElement, busyLabel: string, action: () => Promise<string>): void {
  if (btn.disabled) return
  setBusy(btn, true, busyLabel)
  void action().then(
    (message) => {
      toast(message, 'success')
      refreshRoute()
    },
    (err: unknown) => {
      setBusy(btn, false)
      toast(serverMessage(err), 'error')
    },
  )
}

// -------------------------------------------------------------- list page

export function renderAdmin(_route: Route, _user: User): HTMLElement {
  return asyncView(async () => {
    const all = await listElections()
    const count = (s: ElectionStatus): number => all.filter((e) => e.status === s).length

    const grouped = (['DRAFT', 'OPEN', 'CLOSED', 'PUBLISHED'] as ElectionStatus[])
      .map((s) => ({ status: s, items: all.filter((e) => e.status === s) }))
      .filter((g) => g.items.length > 0)

    return h('div', {},
      pageHead(
        'Election administration',
        'Create elections, build ballots, manage voter rolls and publish results.',
        h('a', { class: 'btn primary', href: '#/admin/new' }, icon('plus', 15), ' New election'),
      ),
      h('div', { class: 'stat-grid' },
        statCard('Total elections', String(all.length), 'box'),
        statCard('Drafts', String(count('DRAFT')), 'edit'),
        statCard('Open', String(count('OPEN')), 'clock'),
        statCard('Published', String(count('PUBLISHED')), 'flag'),
      ),
      grouped.length
        ? h('div', {}, ...grouped.map(({ status, items }) =>
            h('section', { class: 'admin-group' },
              h('h2', { class: 'section-title' }, statusBadge(status), ` ${items.length}`),
              h('div', { class: 'election-grid' }, ...items.map((e) => adminElectionCard(e))),
            ),
          ))
        : emptyState('box', 'No elections yet', 'Create the first draft election to get started.'),
    )
  }, 5)
}

function adminElectionCard(e: Election): HTMLElement {
  return h('article', { class: 'card election-card' },
    h('div', { class: 'election-card-top' }, statusBadge(e.status)),
    h('h3', { class: 'election-title', text: e.title }),
    h('div', { class: 'election-meta' },
      h('span', {}, icon('calendar', 15), ` ${fmtDate(e.startsAt)} — ${fmtDate(e.endsAt)}`),
    ),
    h('div', { class: 'admin-card-actions' },
      h('a', { class: 'btn ghost sm', href: `#/admin/elections/${e.id}` }, icon('edit', 15), ' Manage'),
      ...transitionButtons(e),
    ),
  )
}

function transitionButtons(e: Election): HTMLElement[] {
  const buttons: HTMLElement[] = []
  const meta = TRANSITION_META[e.status]
  const next = NEXT_STATUS[e.status]

  if (meta && next) {
    const btn = h('button', { class: `btn ${meta.className} sm`, type: 'button' }, meta.label) as HTMLButtonElement
    btn.addEventListener('click', () => {
      confirmModal(`${meta.label}?`, meta.confirm, meta.label, () => {
        setBusy(btn, true, 'Working…')
        void transitionElection(e.id, next).then(
          () => {
            toast(`"${e.title}" — ${meta.label.toLowerCase()} done`, 'success')
            refreshRoute()
          },
          (err: unknown) => {
            setBusy(btn, false)
            toast(serverMessage(err), 'error')
          },
        )
      })
    })
    buttons.push(btn)
  }

  if (e.status === 'CLOSED') {
    buttons.push(h('a', { class: 'btn ghost sm', href: `#/elections/${e.id}/results` }, icon('chart', 15), ' Preview results'))
  }

  if (e.status === 'DRAFT') {
    const del = h('button', { class: 'btn danger-outline sm', type: 'button' }, icon('trash', 15), ' Delete') as HTMLButtonElement
    del.addEventListener('click', () => {
      confirmModal('Delete this election?', 'This permanently removes the election, its positions, candidates and voter roll.', 'Delete', () => {
        setBusy(del, true, 'Deleting…')
        void deleteElection(e.id).then(
          () => {
            toast('Election deleted', 'success')
            nav('/admin')
            refreshRoute()
          },
          (err: unknown) => {
            setBusy(del, false)
            toast(serverMessage(err), 'error')
          },
        )
      })
    })
    buttons.push(del)
  }

  return buttons
}

// ----------------------------------------------------------- create page

export function renderAdminNew(_route: Route, _user: User): HTMLElement {
  return h('div', {},
    h('a', { class: 'back-link', href: '#/admin' }, icon('arrowLeft', 15), ' Administration'),
    pageHead('New election', 'New elections start as drafts — configure everything, then open voting.'),
    h('div', { class: 'card form-card' },
      electionForm(
        {
          title: '',
          description: null,
          startsAt: toLocalInput(new Date(Date.now() + 86_400_000).toISOString()),
          endsAt: toLocalInput(new Date(Date.now() + 4 * 86_400_000).toISOString()),
        },
        async (v) => {
          const election = await createElection({
            title: v.title,
            description: v.description,
            startsAt: fromLocalInput(v.startsAt),
            endsAt: fromLocalInput(v.endsAt),
          })
          toast('Election created as draft', 'success')
          nav(`/admin/elections/${election.id}`)
        },
        'Create draft election',
      ),
    ),
  )
}

// ---------------------------------------------------------- manage page

export function renderAdminDetail(route: Route, user: User): HTMLElement {
  const id = route.parts[2] ?? ''

  return asyncView(async () => {
    const detail = await getElectionDetail(id)
    if (!detail) {
      return h('div', {},
        pageHead('Election not found'),
        banner('error', 'No election matches this link.'),
        h('a', { class: 'btn ghost', href: '#/admin' }, icon('arrowLeft', 15), ' Back'),
      )
    }
    const roll = await listRoll(id)
    return buildAdminPage(detail, roll, user)
  }, 6)
}

function buildAdminPage(detail: ElectionDetail, roll: RollEntry[], user: User): HTMLElement {
  const isDraft = detail.status === 'DRAFT'
  const sections: HTMLElement[] = []

  sections.push(h('header', { class: 'detail-header card' },
    h('div', {},
      h('div', { class: 'election-card-top' },
        statusBadge(detail.status),
        h('span', { class: 'muted', text: `${fmtDate(detail.startsAt)} — ${fmtDate(detail.endsAt)}` }),
      ),
      h('h1', { text: detail.title }),
    ),
    (() => {
      const actions = transitionButtons(detail)
      return actions.length ? h('div', { class: 'admin-card-actions' }, ...actions) : h('span')
    })(),
  ))

  if (isDraft) {
    sections.push(h('section', { class: 'card form-card' },
      h('h2', { class: 'section-title', text: 'Details' }),
      electionForm(
        {
          title: detail.title,
          description: detail.description,
          startsAt: toLocalInput(detail.startsAt),
          endsAt: toLocalInput(detail.endsAt),
        },
        async (v) => {
          await updateElection(detail.id, {
            title: v.title,
            description: v.description,
            startsAt: fromLocalInput(v.startsAt),
            endsAt: fromLocalInput(v.endsAt),
          })
          toast('Election updated', 'success')
          refreshRoute()
        },
        'Save changes',
      ),
    ))
  }

  sections.push(positionsSection(detail, isDraft))
  sections.push(rollSection(detail, roll, isDraft))

  if (detail.status === 'CLOSED') {
    sections.push(h('section', {},
      h('h2', { class: 'section-title', text: 'Preliminary results' }),
      asyncView(() => buildResultsView(detail.id, user), 5),
    ))
  }

  return h('div', {},
    h('a', { class: 'back-link', href: '#/admin' }, icon('arrowLeft', 15), ' Administration'),
    ...sections,
  )
}

// -------------------------------------------------- positions & candidates

function positionsSection(detail: ElectionDetail, isDraft: boolean): HTMLElement {
  const cards = detail.positions.map((p) => positionCard(p, isDraft))

  const posTitle = textInput({ placeholder: 'e.g. Treasurer' })
  const posSeats = h('input', { class: 'input input-narrow', type: 'number', min: '1', max: '100', value: '1' }) as HTMLInputElement
  const addBtn = h('button', { class: 'btn primary', type: 'submit' }, icon('plus', 15), ' Add position') as HTMLButtonElement

  const addForm = h('form', { class: 'inline-form', novalidate: 'novalidate' },
    field('Position title', posTitle),
    field('Seats', posSeats),
    addBtn,
  )
  addForm.addEventListener('submit', (e) => {
    e.preventDefault()
    const title = posTitle.value.trim()
    const seats = Number.parseInt(posSeats.value, 10)
    if (!title) return toast('Enter a position title', 'error')
    if (!Number.isFinite(seats) || seats < 1 || seats > 100) return toast('Seats must be between 1 and 100', 'error')
    runAction(addBtn, 'Adding…', async () => {
      await addPosition(detail.id, { title, seats })
      return 'Position added'
    })
  })

  return h('section', {},
    h('h2', { class: 'section-title', text: 'Positions & candidates' }),
    isDraft
      ? h('p', { class: 'muted', text: 'Everything here is locked once the election opens.' })
      : banner('info', 'Voting has started — positions and candidates are read-only.'),
    cards.length
      ? h('div', { class: 'position-list' }, ...cards)
      : emptyState('box', 'No positions yet', 'Add the offices voters will cast ballots for.'),
    isDraft ? h('div', { class: 'card form-card' }, addForm) : h('span'),
  )
}

function positionCard(
  position: ElectionDetail['positions'][number],
  isDraft: boolean,
): HTMLElement {
  const removePos = isDraft
    ? (() => {
        const btn = h('button', { class: 'btn danger-outline sm', type: 'button' }, icon('trash', 14), ' Remove') as HTMLButtonElement
        btn.addEventListener('click', () => {
          confirmModal(`Delete "${position.title}"?`, 'Its candidates will be removed too.', 'Delete', () => {
            setBusy(btn, true, 'Deleting…')
            void deletePosition(position.id).then(
              () => {
                toast('Position deleted', 'success')
                refreshRoute()
              },
              (err: unknown) => {
                setBusy(btn, false)
                toast(serverMessage(err), 'error')
              },
            )
          })
        })
        return btn
      })()
    : undefined

  const name = textInput({ placeholder: 'Candidate full name' })
  const manifesto = h('input', { class: 'input', type: 'text', placeholder: 'Manifesto (optional)' }) as HTMLInputElement
  const addBtn = h('button', { class: 'btn ghost', type: 'submit' }, icon('plus', 15), ' Add') as HTMLButtonElement

  const candidateForm = h('form', { class: 'inline-form', novalidate: 'novalidate' },
    field('Add candidate', name),
    field('Manifesto', manifesto),
    addBtn,
  )
  candidateForm.addEventListener('submit', (e) => {
    e.preventDefault()
    const fullName = name.value.trim()
    if (!fullName) return toast('Enter the candidate\'s name', 'error')
    runAction(addBtn, 'Adding…', async () => {
      await addCandidate(position.id, { fullName, manifesto: manifesto.value.trim() || null })
      return 'Candidate added'
    })
  })

  return h('section', { class: 'card position-card' },
    h('div', { class: 'position-head' },
      h('h3', { text: position.title }),
      h('span', { class: 'pill', text: position.seats === 1 ? '1 seat' : `${position.seats} seats` }),
      removePos,
    ),
    position.candidates.length
      ? h('div', { class: 'admin-candidate-list' },
          ...position.candidates.map((c) =>
            h('div', { class: 'admin-candidate' },
              avatar(c.fullName, c.photoUrl, 32),
              h('span', { class: 'admin-candidate-name', text: c.fullName }),
              isDraft
                ? (() => {
                    const btn = h('button', { class: 'btn danger-outline sm', type: 'button' }, icon('trash', 14), ' Remove') as HTMLButtonElement
                    btn.addEventListener('click', () => {
                      setBusy(btn, true, '…')
                      void deleteCandidate(c.id).then(
                        () => {
                          toast('Candidate removed', 'success')
                          refreshRoute()
                        },
                        (err: unknown) => {
                          setBusy(btn, false)
                          toast(serverMessage(err), 'error')
                        },
                      )
                    })
                    return btn
                  })()
                : undefined,
            ),
          ),
        )
      : h('p', { class: 'muted sm-text', text: isDraft ? 'No candidates yet — add at least one to open voting.' : 'No candidates.' }),
    isDraft ? candidateForm : h('span'),
  )
}

// --------------------------------------------------------------- voter roll

function rollSection(detail: ElectionDetail, roll: RollEntry[], isDraft: boolean): HTMLElement {
  const matricInput = textInput({ placeholder: 'CSC/2023/001, CSC/2023/014' })
  const addBtn = h('button', { class: 'btn primary', type: 'submit' }, icon('plus', 15), ' Add to roll') as HTMLButtonElement

  const addForm = h('form', { class: 'inline-form', novalidate: 'novalidate' },
    field('Add voters by matric number', matricInput, 'Comma or space separated. User IDs work too.'),
    addBtn,
  )
  addForm.addEventListener('submit', (e) => {
    e.preventDefault()
    const tokens = matricInput.value.split(/[\s,]+/).map((t) => t.trim()).filter(Boolean)
    if (tokens.length === 0) return toast('Enter at least one matric number', 'error')
    runAction(addBtn, 'Adding…', async () => {
      const summary = await addToRoll(detail.id, tokens)
      const missing = [...(summary.notFoundMatrics ?? []), ...(summary.notFoundUserIds ?? [])]
      if (summary.totalAdded === 0 && missing.length > 0) {
        throw new Error(`No matching users found: ${missing.join(', ')}`)
      }
      const suffix = missing.length > 0 ? ` (${missing.length} not found)` : ''
      return `Added ${summary.totalAdded} voter(s)${suffix}`
    })
  })

  return h('section', {},
    h('div', { class: 'position-head' },
      h('h2', { class: 'section-title', text: 'Voter roll' }),
      h('span', { class: 'pill roll-count', text: ` (${roll.length})` }),
    ),
    roll.length
      ? h('div', { class: 'roll-list' },
          ...roll.map((entry) =>
            h('div', { class: 'roll-row' },
              avatar(entry.fullName, null, 32),
              h('div', { class: 'roll-info' },
                h('strong', { text: entry.fullName }),
                h('span', { class: 'muted sm-text', text: entry.matricNo ? `${entry.matricNo} · ${entry.email}` : entry.email }),
              ),
              isDraft
                ? (() => {
                    const btn = h('button', { class: 'btn danger-outline sm', type: 'button' }, 'Remove') as HTMLButtonElement
                    btn.addEventListener('click', () => {
                      setBusy(btn, true, '…')
                      void removeFromRoll(detail.id, entry.userId).then(
                        () => {
                          toast(`${entry.fullName} removed from roll`, 'success')
                          refreshRoute()
                        },
                        (err: unknown) => {
                          setBusy(btn, false)
                          toast(serverMessage(err), 'error')
                        },
                      )
                    })
                    return btn
                  })()
                : h('span', { class: 'pill pill-muted', text: 'Locked' }),
            ),
          ),
        )
      : emptyState('users', 'Roll is empty', isDraft ? 'Add voters below — only they can cast a ballot.' : 'No voters were registered for this election.'),
    isDraft
      ? addForm
      : banner('info', 'The voter roll is locked once the election opens.'),
  )
}
