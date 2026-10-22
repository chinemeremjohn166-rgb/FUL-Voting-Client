import type { ElectionDetail, Position, Selection, User } from '../types'
import type { Route } from '../router'
import { nav } from '../router'
import { castBallot, findMyReceipt, getElectionDetail, saveMyReceipt } from '../services'
import {
  asyncView,
  avatar,
  banner,
  copyText,
  fmtDateTime,
  h,
  icon,
  openModal,
  pageHead,
  setBusy,
  statusBadge,
  toast,
} from '../ui'

interface PositionPick {
  candidateIds: Set<string>
  abstain: boolean
}

export function renderBallot(route: Route, _user: User): HTMLElement {
  const id = route.parts[1] ?? ''

  return asyncView(async () => {
    const detail = await getElectionDetail(id)

    if (!detail || detail.status !== 'OPEN') {
      return h('div', {},
        pageHead('Ballot unavailable'),
        banner('error', 'This election is not open for voting.'),
        h('a', { class: 'btn ghost', href: `#/elections/${id}` }, icon('arrowLeft', 15), ' Back to election'),
      )
    }
    if (!detail.viewerStatus.isEligible) {
      return h('div', {},
        pageHead('Not on the voter roll'),
        banner('warn', 'Only registered voters on this election\'s roll can cast a ballot.'),
        h('a', { class: 'btn ghost', href: `#/elections/${id}` }, icon('arrowLeft', 15), ' Back to election'),
      )
    }
    if (detail.viewerStatus.hasVoted) {
      return h('div', {},
        pageHead('Ballot already cast'),
        banner('info', 'You have already voted in this election. One ballot per voter is enforced.'),
        h('a', { class: 'btn primary', href: `#/receipt/${id}` }, icon('check', 15), ' View my receipt'),
      )
    }
    return buildBallot(detail)
  })
}

function buildBallot(election: ElectionDetail): HTMLElement {
  const picks = new Map<string, PositionPick>()
  for (const p of election.positions) picks.set(p.id, { candidateIds: new Set(), abstain: false })

  const progressText = h('span', { class: 'ballot-progress-text' })
  const submitBtn = h('button', { class: 'btn primary', type: 'button', disabled: true }, 'Review & cast ballot') as HTMLButtonElement

  const decidedCount = (): number => {
    let n = 0
    for (const p of election.positions) {
      const pick = picks.get(p.id)!
      if (pick.abstain || pick.candidateIds.size > 0) n++
    }
    return n
  }

  const positionSections = election.positions.map((p) => buildPositionSection(p, picks.get(p.id)!, update))

  function update(): void {
    const done = decidedCount()
    progressText.textContent = `${done} of ${election.positions.length} positions decided`
    submitBtn.toggleAttribute('disabled', done !== election.positions.length)
    for (const section of positionSections) section.refresh()
  }

  submitBtn.addEventListener('click', () => showConfirmModal(election, picks))

  update()

  return h('div', { class: 'ballot-page' },
    pageHead(
      'Cast your ballot',
      undefined,
      h('span', { class: 'detail-header-title' }, statusBadge(election.status)),
    ),
    h('p', { class: 'muted ballot-intro' },
      `Voting closes ${fmtDateTime(election.endsAt)}. Review each position, pick up to the seat limit, or abstain. `,
      'Your choices are anonymised before storage and can never be linked to your name.',
    ),
    h('div', { class: 'ballot-list' }, ...positionSections.map((s) => s.el)),
    h('div', { class: 'ballot-footer' },
      h('span', { class: 'ballot-secrecy' }, icon('shield', 15), ' Secret ballot — no record of your choices is kept with your identity'),
      h('div', { class: 'ballot-footer-right' }, progressText, submitBtn),
    ),
  )
}

function buildPositionSection(position: Position, pick: PositionPick, onChange: () => void): { el: HTMLElement; refresh: () => void } {
  const counter = h('span', { class: 'position-counter' })
  const candidateRows: { candidateId: string; row: HTMLElement; btn: HTMLButtonElement }[] = []
  const abstainBox = h('input', { type: 'checkbox' }) as HTMLInputElement

  const refresh = (): void => {
    const limit = position.seats
    counter.textContent = pick.abstain
      ? 'Abstaining'
      : `${pick.candidateIds.size}/${limit} selected`
    counter.classList.toggle('done', pick.abstain || pick.candidateIds.size > 0)
    for (const { candidateId, row, btn } of candidateRows) {
      const selected = pick.candidateIds.has(candidateId)
      row.classList.toggle('selected', selected)
      btn.classList.toggle('primary', selected)
      btn.setAttribute('aria-pressed', String(selected))
      const atLimit = !selected && pick.candidateIds.size >= limit
      btn.toggleAttribute('disabled', pick.abstain || atLimit)
      btn.textContent = selected ? 'Selected' : atLimit ? 'Limit reached' : 'Select'
    }
    abstainBox.checked = pick.abstain
  }

  for (const candidate of position.candidates) {
    const btn = h('button', { class: 'btn ghost sm', type: 'button' }) as HTMLButtonElement
    btn.addEventListener('click', () => {
      if (pick.candidateIds.has(candidate.id)) {
        pick.candidateIds.delete(candidate.id)
      } else if (pick.candidateIds.size < position.seats) {
        pick.candidateIds.add(candidate.id)
        pick.abstain = false
      }
      onChange()
    })
    const row = h('div', { class: 'candidate ballot-candidate' },
      avatar(candidate.fullName, candidate.photoUrl, 40),
      h('div', { class: 'candidate-body' },
        h('h4', { text: candidate.fullName }),
        candidate.manifesto
          ? h('details', { class: 'manifesto' }, h('summary', { text: 'Manifesto' }), h('p', { text: candidate.manifesto }))
          : undefined,
      ),
      btn,
    )
    candidateRows.push({ candidateId: candidate.id, row, btn })
  }

  abstainBox.addEventListener('change', () => {
    pick.abstain = abstainBox.checked
    if (pick.abstain) pick.candidateIds.clear()
    onChange()
  })

  const el = h('section', { class: 'card position-card' },
    h('div', { class: 'position-head' },
      h('h3', { text: position.title }),
      h('span', { class: 'pill', text: position.seats === 1 ? 'Choose 1' : `Choose up to ${position.seats}` }),
      counter,
    ),
    h('div', { class: 'ballot-candidates' }, ...candidateRows.map((c) => c.row)),
    h('label', { class: 'abstain-row' }, abstainBox, h('span', { text: 'Abstain from this position (counted as a blank vote)' })),
  )

  refresh()
  return { el, refresh }
}

function showConfirmModal(detail: ElectionDetail, picks: Map<string, PositionPick>): void {
  const summaryRows = detail.positions.map((p) => {
    const pick = picks.get(p.id)!
    const value = pick.abstain
      ? 'Abstain (blank vote)'
      : [...pick.candidateIds].map((id) => p.candidates.find((c) => c.id === id)?.fullName ?? 'Unknown').join(', ')
    return h('div', { class: 'confirm-row' }, h('span', { class: 'confirm-pos', text: p.title }), h('strong', { text: value }))
  })

  const errorEl = h('p', { class: 'form-error', style: 'display:none' })
  const castBtn = h('button', { class: 'btn primary', type: 'button' }, 'Cast ballot') as HTMLButtonElement

  const { close } = openModal(h('div', {},
    h('h2', { class: 'modal-title', text: 'Cast this ballot?' }),
    h('p', { class: 'modal-text', text: 'This cannot be undone. Once cast, a ballot is anonymous and cannot be changed or revoked.' }),
    h('div', { class: 'confirm-summary' }, ...summaryRows),
    errorEl,
    h('div', { class: 'modal-actions' },
      h('button', { class: 'btn ghost', type: 'button', onClick: () => close() }, 'Go back'),
      castBtn,
    ),
  ), { wide: true })

  let busy = false

  async function onCast(): Promise<void> {
    if (busy) return
    const selections: Selection[] = []
    for (const p of detail.positions) {
      const pick = picks.get(p.id)!
      if (pick.abstain) {
        selections.push({ positionId: p.id, candidateId: null })
      } else {
        for (const candidateId of pick.candidateIds) selections.push({ positionId: p.id, candidateId })
      }
    }

    busy = true
    setBusy(castBtn, true, 'Casting ballot…')
    try {
      const result = await castBallot(detail.id, selections)
      // Ballot secrecy means the API can never hand back "my ballots" — the
      // receipt is kept locally at cast time so the receipt page works later.
      saveMyReceipt({
        electionId: result.electionId,
        receiptCode: result.receiptCode,
        castAt: new Date().toISOString(),
      })
      close()
      toast('Ballot cast successfully', 'success')
      nav(`/receipt/${detail.id}`)
    } catch (err) {
      busy = false
      setBusy(castBtn, false)
      errorEl.textContent = err instanceof Error && err.message ? err.message : 'The server rejected this ballot.'
      errorEl.style.display = 'block'
    }
  }

  castBtn.addEventListener('click', () => void onCast())
}

// --------------------------------------------------------------- receipt

export function renderReceipt(route: Route, _user: User): HTMLElement {
  const id = route.parts[1] ?? ''

  return asyncView(async () => {
    const receipt = findMyReceipt(id)
    const detail = await getElectionDetail(id)

    if (!receipt || !detail) {
      return h('div', {},
        pageHead('No receipt found'),
        banner('error', 'No ballot cast from this browser is recorded for this election.'),
        h('a', { class: 'btn ghost', href: '#/elections' }, icon('arrowLeft', 15), ' Back to elections'),
      )
    }

    return h('div', { class: 'receipt-page' },
      h('div', { class: 'card receipt-card' },
        h('span', { class: 'receipt-icon' }, icon('check', 36)),
        h('h1', { text: 'Ballot cast' }),
        h('p', { class: 'muted', text: `Your ballot in "${detail.title}" was recorded anonymously.` }),
        h('div', { class: 'receipt-code-row' },
          h('code', { class: 'receipt-code', text: receipt.receiptCode }),
          h('button', { class: 'btn ghost', type: 'button', onClick: () => void copyText(receipt.receiptCode) }, icon('copy', 15), ' Copy'),
        ),
        h('p', { class: 'muted sm-text', text: `Cast ${fmtDateTime(receipt.castAt)}` }),
        banner('info', 'Keep this code private. It proves that a ballot was cast, but the system deliberately stores no link between this receipt and your choices.'),
        h('div', { class: 'receipt-actions' },
          h('a', {
            class: 'btn primary',
            href: `#/verify?code=${encodeURIComponent(receipt.receiptCode)}&election=${encodeURIComponent(receipt.electionId)}`,
          }, icon('search', 15), ' Verify this receipt'),
          h('a', { class: 'btn ghost', href: '#/elections' }, ' Back to elections'),
        ),
      ),
    )
  })
}
