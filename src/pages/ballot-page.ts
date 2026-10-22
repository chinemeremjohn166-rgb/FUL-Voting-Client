// The ballot. This is the only page that keeps answers in memory before sending
// anything, so the whole page works like this:
//
//   1. render() asks the API what the ballot looks like
//   2. clicks only change the `picks` object and re-paint the page
//   3. nothing is sent until "Cast ballot" is pressed, and it cannot be undone

import { castBallot, getElection } from '../api'
import { saveReceipt } from '../receipts'
import { ElectionDetail, Page, Selection } from '../types'
import { avatar, banner, esc, formatDateTime, icon, pageHead, setBusy, statusBadge, toast, windowState } from '../ui'

interface Picks {
  candidateIds: string[]
  abstain: boolean
}

export function ballotPage(electionId: string): Page {
  let election: ElectionDetail | null = null
  const picks = new Map<string, Picks>()

  return {
    title: 'Cast your ballot',

    async render() {
      const loaded = await getElection(electionId)

      if (!loaded || loaded.status !== 'OPEN') {
        return `${pageHead('Ballot unavailable')}
          ${banner('error', 'This election is not open for voting.')}
          <a class="btn ghost" href="#/elections/${esc(electionId)}">${icon('arrowLeft', 15)} Back to election</a>`
      }

      // Status can be OPEN before the starting time arrives, and the server
      // refuses a ballot from anyone who tries anyway.
      const voting = windowState(loaded.startsAt, loaded.endsAt)
      if (voting !== 'live') {
        const why = voting === 'pending'
          ? `Voting opens ${formatDateTime(loaded.startsAt)}. The ballot will appear here once the clock reaches that time.`
          : `Voting closed ${formatDateTime(loaded.endsAt)}. No more ballots are accepted.`
        return `${pageHead('Ballot unavailable')}
          ${banner('warn', why)}
          <a class="btn ghost" href="#/elections/${esc(electionId)}">${icon('arrowLeft', 15)} Back to election</a>`
      }
      if (!loaded.viewerStatus.isEligible) {
        return `${pageHead('Not on the voter roll')}
          ${banner('warn', "Only registered voters on this election's roll can cast a ballot.")}
          <a class="btn ghost" href="#/elections/${esc(electionId)}">${icon('arrowLeft', 15)} Back to election</a>`
      }
      if (loaded.viewerStatus.hasVoted) {
        return `${pageHead('Ballot already cast')}
          ${banner('info', 'You have already voted in this election. One ballot per voter is enforced.')}
          <a class="btn primary" href="#/receipt/${esc(electionId)}">${icon('check', 15)} View my receipt</a>`
      }

      election = loaded
      for (const position of election.positions) {
        picks.set(position.id, { candidateIds: [], abstain: false })
      }

      return `<div class="ballot-page">
        ${pageHead('Cast your ballot', '', statusBadge(election.status))}
        <p class="muted ballot-intro">
          Voting closes ${formatDateTime(election.endsAt)}. Review each position, pick up to the seat limit, or abstain.
          Your choices are anonymised before storage and can never be linked to your name.
        </p>
        <div class="ballot-list">${election.positions.map(positionHtml).join('')}</div>
        <div class="ballot-footer">
          <span class="ballot-secrecy">${icon('shield', 15)} Secret ballot — no record of your choices is kept with your identity</span>
          <div class="ballot-footer-right">
            <span class="ballot-progress-text" data-progress></span>
            <button class="btn primary" type="button" data-review disabled>Review &amp; cast ballot</button>
          </div>
        </div>
        <div data-confirm-slot></div>
      </div>`
    },

    bind(root) {
      if (!election) return
      const detail = election

      // Every click on a candidate button lands here.
      root.querySelectorAll('[data-pick]').forEach((button) => {
        button.addEventListener('click', () => {
          const candidateId = button.getAttribute('data-pick') ?? ''
          const section = button.closest('[data-position]')
          if (!section || !candidateId) return
          const positionId = section.getAttribute('data-position') ?? ''
          const position = detail.positions.find((item) => item.id === positionId)
          const chosen = picks.get(positionId)
          if (!position || !chosen) return

          if (chosen.candidateIds.includes(candidateId)) {
            chosen.candidateIds = chosen.candidateIds.filter((id) => id !== candidateId)
          } else if (chosen.candidateIds.length < position.seats) {
            chosen.candidateIds.push(candidateId)
            chosen.abstain = false
          }
          paint(root, detail, picks)
        })
      })

      root.querySelectorAll('[data-abstain]').forEach((box) => {
        box.addEventListener('change', () => {
          const section = box.closest('[data-position]')
          const positionId = section?.getAttribute('data-position') ?? ''
          const chosen = picks.get(positionId)
          if (!chosen) return
          chosen.abstain = (box as HTMLInputElement).checked
          if (chosen.abstain) chosen.candidateIds = []
          paint(root, detail, picks)
        })
      })

      const review = root.querySelector<HTMLButtonElement>('[data-review]')
      review?.addEventListener('click', () => showConfirmation(root, detail, picks, review))

      paint(root, detail, picks)
    },
  }
}

function positionHtml(position: ElectionDetail['positions'][number]): string {
  const rows = position.candidates.map((candidate) => `<div class="candidate ballot-candidate" data-row="${esc(candidate.id)}">
      ${avatar(candidate.fullName, candidate.photoUrl, 40)}
      <div class="candidate-body">
        <h4>${esc(candidate.fullName)}</h4>
        ${candidate.manifesto ? `<details class="manifesto"><summary>Manifesto</summary><p>${esc(candidate.manifesto)}</p></details>` : ''}
      </div>
      <button class="btn ghost sm" type="button" data-pick="${esc(candidate.id)}">Select</button>
    </div>`).join('')

  return `<section class="card position-card" data-position="${esc(position.id)}" data-seats="${position.seats}">
    <div class="position-head">
      <h3>${esc(position.title)}</h3>
      <span class="pill">${position.seats === 1 ? 'Choose 1' : `Choose up to ${position.seats}`}</span>
      <span class="position-counter" data-counter></span>
    </div>
    <div class="ballot-candidates">${rows}</div>
    <label class="abstain-row">
      <input type="checkbox" data-abstain>
      <span>Abstain from this position (counted as a blank vote)</span>
    </label>
  </section>`
}

/**
 * Re-paints the parts of the page that depend on the current picks. The page
 * itself is never rebuilt, so nothing a voter already chose gets lost.
 */
function paint(root: HTMLElement, election: ElectionDetail, picks: Map<string, Picks>): void {
  let decided = 0

  for (const position of election.positions) {
    const section = root.querySelector(`[data-position="${position.id}"]`)
    const chosen = picks.get(position.id)
    if (!section || !chosen) continue

    if (chosen.abstain || chosen.candidateIds.length > 0) decided++

    const counter = section.querySelector('[data-counter]')
    if (counter) {
      counter.textContent = chosen.abstain ? 'Abstaining' : `${chosen.candidateIds.length}/${position.seats} selected`
      counter.classList.toggle('done', chosen.abstain || chosen.candidateIds.length > 0)
    }

    const atLimit = chosen.candidateIds.length >= position.seats
    section.querySelectorAll('[data-pick]').forEach((button) => {
      const candidateId = button.getAttribute('data-pick') ?? ''
      const selected = chosen.candidateIds.includes(candidateId)
      const row = section.querySelector(`[data-row="${candidateId}"]`)
      row?.classList.toggle('selected', selected)
      button.classList.toggle('primary', selected)
      button.setAttribute('aria-pressed', String(selected))
      button.toggleAttribute('disabled', chosen.abstain || (atLimit && !selected))
      button.textContent = selected ? 'Selected' : atLimit && !selected ? 'Limit reached' : 'Select'
    })

    const box = section.querySelector<HTMLInputElement>('[data-abstain]')
    if (box) box.checked = chosen.abstain
  }

  const progress = root.querySelector('[data-progress]')
  if (progress) progress.textContent = `${decided} of ${election.positions.length} positions decided`

  const review = root.querySelector<HTMLButtonElement>('[data-review]')
  if (review) review.toggleAttribute('disabled', decided !== election.positions.length)
}

/** Turns the picks into the flat list the API expects, with abstentions as null. */
function toSelections(election: ElectionDetail, picks: Map<string, Picks>): Selection[] {
  const selections: Selection[] = []
  for (const position of election.positions) {
    const chosen = picks.get(position.id)
    if (!chosen) continue
    if (chosen.abstain) {
      selections.push({ positionId: position.id, candidateId: null })
    } else {
      for (const candidateId of chosen.candidateIds) {
        selections.push({ positionId: position.id, candidateId })
      }
    }
  }
  return selections
}

function showConfirmation(root: HTMLElement, election: ElectionDetail, picks: Map<string, Picks>, review: HTMLButtonElement): void {
  const slot = root.querySelector('[data-confirm-slot]')
  if (!slot) return

  const rows = election.positions.map((position) => {
    const chosen = picks.get(position.id)
    const names = chosen?.abstain
      ? 'Abstain (blank vote)'
      : (chosen?.candidateIds ?? [])
          .map((id) => position.candidates.find((candidate) => candidate.id === id)?.fullName ?? 'Unknown')
          .join(', ')
    return `<div class="confirm-row"><span class="confirm-pos">${esc(position.title)}</span><strong>${esc(names)}</strong></div>`
  }).join('')

  // Not a real modal window — it sits in the page where the voter is working —
  // but it is a decision that must not be missed, so it is named, focused, and
  // hands focus back to "Review ballot" when dismissed.
  slot.innerHTML = `<div class="card confirm-card" role="dialog" aria-labelledby="ballot-confirm-title">
    <h2 class="modal-title" id="ballot-confirm-title" tabindex="-1">Cast this ballot?</h2>
    <p class="modal-text">This cannot be undone. Once cast, a ballot is anonymous and cannot be changed or revoked.</p>
    <div class="confirm-summary">${rows}</div>
    <p class="form-error" data-error role="alert" style="display:none"></p>
    <div class="modal-actions">
      <button class="btn ghost" type="button" data-cancel>Go back</button>
      <button class="btn primary" type="button" data-cast>Cast ballot</button>
    </div>
  </div>`
  slot.querySelector<HTMLElement>('#ballot-confirm-title')?.focus()
  slot.scrollIntoView({ behavior: 'smooth', block: 'center' })

  slot.querySelector('[data-cancel]')?.addEventListener('click', () => {
    slot.innerHTML = ''
    review.focus()
  })

  const castButton = slot.querySelector<HTMLButtonElement>('[data-cast]')
  const errorLine = slot.querySelector<HTMLElement>('[data-error]')
  if (!castButton || !errorLine) return

  castButton.addEventListener('click', async () => {
    setBusy(castButton, true, 'Casting ballot…')
    try {
      const receipt = await castBallot(election.id, toSelections(election, picks))
      // The API never hands back "my ballots" (ballots are anonymous), so the
      // receipt is remembered in this browser the moment it is issued.
      saveReceipt(receipt)

      // The voter may have moved to another page while this request was in
      // flight. The ballot is cast either way, but a page that is no longer on
      // screen must not drag them back to it.
      if (!castButton.isConnected) return

      slot.innerHTML = ''
      toast('Ballot cast successfully', 'success')
      location.hash = `#/receipt/${election.id}`
    } catch (error: any) {
      if (!castButton.isConnected) return
      setBusy(castButton, false)
      errorLine.removeAttribute('style')
      errorLine.textContent = error.message
    }
  })
}
