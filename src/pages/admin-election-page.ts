// Everything one election needs: its details, the positions and candidates on
// its ballot, and the list of people allowed to vote.
//
// The rule this page follows: while an election is a DRAFT you may change any
// of it. The moment voting opens, the API refuses — so the page simply stops
// drawing those buttons instead of offering ones that would fail.

import {
  addCandidate,
  addPosition,
  addVoters,
  deleteCandidate,
  deletePosition,
  getElection,
  getVoterRoll,
  removeVoter,
  updateElection,
} from '../api'
import { Candidate, ElectionDetail, Page, Position, RollEntry } from '../types'
import {
  avatar,
  banner,
  emptyState,
  esc,
  field,
  formatDate,
  fromLocalInput,
  icon,
  pageHead,
  statusBadge,
  toLocalInput,
  toast,
} from '../ui'
import { bindElectionDeletes, bindTransitions, clickButtons, deleteElectionButtonHtml, runAction, transitionButtonHtml } from './admin-common'
import { bindElectionForm, electionFormHtml, reloadPage } from './election-form'
import { resultsHtml } from './results-page'

export function adminElectionPage(electionId: string): Page {
  return {
    title: 'Manage election',

    async render() {
      const detail = await getElection(electionId)
      if (!detail) {
        return `${pageHead('Election not found')}
          ${banner('error', 'No election matches this link.')}
          <a class="btn ghost" href="#/admin">${icon('arrowLeft', 15)} Back</a>`
      }

      const roll = await getVoterRoll(electionId)
      const isDraft = detail.status === 'DRAFT'
      const results = detail.status === 'CLOSED' ? await resultsHtml(detail.id, detail) : ''

      return `<a class="back-link" href="#/admin">${icon('arrowLeft', 15)} Administration</a>
        ${headerHtml(detail)}
        ${isDraft ? detailsCard(detail) : ''}
        ${positionsCard(detail, isDraft)}
        ${rollCard(roll, isDraft)}
        ${results ? `<section><h2 class="section-title">Preliminary results</h2>${results}</section>` : ''}`
    },

    bind(root) {
      bindTransitions(root)
      // This page has just been deleted, so go back to the list of elections.
      bindElectionDeletes(root, () => {
        location.hash = '#/admin'
      })

      // Only a draft has the details form on the page.
      const details = root.querySelector<HTMLElement>('[data-details]')
      if (details) {
        bindElectionForm(details, async (values) => {
          await updateElection(electionId, {
            title: values.title,
            description: values.description,
            startsAt: fromLocalInput(values.startsAt),
            endsAt: fromLocalInput(values.endsAt),
          })
          toast('Election updated', 'success')
          reloadPage()
        })
      }

      bindAddPosition(root, electionId)
      bindAddCandidates(root)
      bindAddVoters(root, electionId)
      bindRemoves(root, electionId)
    },
  }
}

function headerHtml(detail: ElectionDetail): string {
  const buttons = [transitionButtonHtml(detail), deleteElectionButtonHtml(detail)].join('')
  return `<header class="detail-header card">
    <div>
      <div class="election-card-top">
        ${statusBadge(detail.status)}
        <span class="muted">${formatDate(detail.startsAt)} — ${formatDate(detail.endsAt)}</span>
      </div>
      <h1>${esc(detail.title)}</h1>
      ${detail.description ? `<p class="muted">${esc(detail.description)}</p>` : ''}
    </div>
    ${buttons ? `<div class="admin-card-actions">${buttons}</div>` : ''}
  </header>`
}

// ------------------------------------------------------------------ details

function detailsCard(detail: ElectionDetail): string {
  const values = {
    title: detail.title,
    description: detail.description,
    startsAt: toLocalInput(detail.startsAt),
    endsAt: toLocalInput(detail.endsAt),
  }
  return `<section class="card form-card" data-details>
    <h2 class="section-title">Details</h2>
    ${electionFormHtml(values, 'Save changes')}
  </section>`
}

// ---------------------------------------------------- positions & candidates

function positionsCard(detail: ElectionDetail, isDraft: boolean): string {
  return `<section>
    <h2 class="section-title">Positions &amp; candidates</h2>
    ${isDraft
      ? '<p class="muted">Everything here is locked once the election opens.</p>'
      : banner('info', 'Voting has started — positions and candidates are read-only.')}
    ${detail.positions.length
      ? `<div class="position-list">${detail.positions.map((p) => positionHtml(p, isDraft)).join('')}</div>`
      : emptyState('box', 'No positions yet', 'Add the offices voters will cast ballots for.')}
    ${isDraft ? addPositionFormHtml() : ''}
  </section>`
}

function positionHtml(position: Position, isDraft: boolean): string {
  return `<section class="card position-card">
    <div class="position-head">
      <h3>${esc(position.title)}</h3>
      <span class="pill">${position.seats === 1 ? '1 seat' : `${position.seats} seats`}</span>
      ${isDraft ? removeButtonHtml('position', position.id, position.title) : ''}
    </div>
    ${position.candidates.length
      ? `<div class="admin-candidate-list">${position.candidates.map((c) => candidateRowHtml(c, isDraft)).join('')}</div>`
      : `<p class="muted sm-text">${isDraft ? 'No candidates yet — add at least one to open voting.' : 'No candidates.'}</p>`}
    ${isDraft ? addCandidateFormHtml(position) : ''}
  </section>`
}

function candidateRowHtml(candidate: Candidate, isDraft: boolean): string {
  return `<div class="admin-candidate">
    ${avatar(candidate.fullName, candidate.photoUrl, 32)}
    <span class="admin-candidate-name">${esc(candidate.fullName)}</span>
    ${isDraft ? removeButtonHtml('candidate', candidate.id, candidate.fullName) : ''}
  </div>`
}

function addPositionFormHtml(): string {
  return `<div class="card form-card">
    <form class="inline-form" data-add-position novalidate>
      ${field('Position title', '<input class="input" type="text" name="title" placeholder="e.g. Treasurer">')}
      ${field('Seats', '<input class="input input-narrow" type="number" name="seats" min="1" max="100" value="1">')}
      <button class="btn primary" type="submit">${icon('plus', 15)} Add position</button>
    </form>
  </div>`
}

function addCandidateFormHtml(position: Position): string {
  return `<form class="inline-form" data-add-candidate="${esc(position.id)}" novalidate>
    ${field('Add candidate', '<input class="input" type="text" name="fullName" placeholder="Candidate full name">')}
    ${field('Manifesto', '<input class="input" type="text" name="manifesto" placeholder="Manifesto (optional)">')}
    <button class="btn ghost" type="submit">${icon('plus', 15)} Add</button>
  </form>`
}

/**
 * The little red button on a row. It carries what kind of thing it is, its id,
 * and its name, so one click handler on the page can deal with all of them.
 */
function removeButtonHtml(kind: 'position' | 'candidate' | 'voter', id: string, name: string): string {
  return `<button class="btn danger-outline sm" type="button" data-remove="${kind}" data-id="${esc(id)}" data-name="${esc(name)}">${icon('trash', 14)} Remove</button>`
}

// ---------------------------------------------------------------- voter roll

function rollCard(roll: RollEntry[], isDraft: boolean): string {
  return `<section>
    <div class="position-head">
      <h2 class="section-title">Voter roll</h2>
      <span class="pill roll-count">(${roll.length})</span>
    </div>
    ${roll.length ? `<div class="roll-list">${roll.map((entry) => rollRowHtml(entry, isDraft)).join('')}</div>` : ''}
    ${roll.length
      ? ''
      : emptyState('users', 'Roll is empty', isDraft ? 'Add voters below — only they can cast a ballot.' : 'No voters were registered for this election.')}
    ${isDraft
      ? `<form class="inline-form" data-add-voters novalidate>
          ${field('Add voters by matric number', '<input class="input" type="text" name="tokens" placeholder="CSC/2023/001, CSC/2023/014">', 'Comma or space separated. User IDs work too.')}
          <button class="btn primary" type="submit">${icon('plus', 15)} Add to roll</button>
        </form>`
      : banner('info', 'The voter roll is locked once the election opens.')}
  </section>`
}

function rollRowHtml(entry: RollEntry, isDraft: boolean): string {
  return `<div class="roll-row">
    ${avatar(entry.fullName, null, 32)}
    <div class="roll-info">
      <strong>${esc(entry.fullName)}</strong>
      <span class="muted sm-text">${entry.matricNo ? `${esc(entry.matricNo)} · ${esc(entry.email)}` : esc(entry.email)}</span>
    </div>
    ${isDraft ? removeButtonHtml('voter', entry.userId, entry.fullName) : '<span class="pill pill-muted">Locked</span>'}
  </div>`
}

// ----------------------------------------------------------------- the wiring

/** Reads an input inside a form, with the spaces taken off. */
function inputValue(form: HTMLFormElement, name: string): string {
  const item = form.elements.namedItem(name) as HTMLInputElement | HTMLTextAreaElement | null
  return item ? item.value.trim() : ''
}

/**
 * Wires up every "fill this in, press add" form that matches `selector`: the
 * button dims while the request is in flight, then the page is fetched again.
 */
function bindAddForms(root: HTMLElement, selector: string, work: (form: HTMLFormElement) => Promise<string>): void {
  for (const form of root.querySelectorAll<HTMLFormElement>(selector)) {
    const button = form.querySelector<HTMLButtonElement>('button[type=submit]')
    if (!button) continue
    form.addEventListener('submit', (event) => {
      event.preventDefault()
      runAction(button, 'Adding…', () => work(form))
    })
  }
}

function bindAddPosition(root: HTMLElement, electionId: string): void {
  bindAddForms(root, 'form[data-add-position]', async (form) => {
    const title = inputValue(form, 'title')
    const seats = Number.parseInt(inputValue(form, 'seats'), 10)
    if (!title) throw new Error('Enter a position title')
    if (!Number.isFinite(seats) || seats < 1 || seats > 100) throw new Error('Seats must be between 1 and 100')
    await addPosition(electionId, title, seats)
    return 'Position added'
  })
}

function bindAddCandidates(root: HTMLElement): void {
  bindAddForms(root, 'form[data-add-candidate]', async (form) => {
    const fullName = inputValue(form, 'fullName')
    if (!fullName) throw new Error("Enter the candidate's name")
    await addCandidate(form.dataset.addCandidate ?? '', fullName, inputValue(form, 'manifesto') || null)
    return 'Candidate added'
  })
}

function bindAddVoters(root: HTMLElement, electionId: string): void {
  bindAddForms(root, 'form[data-add-voters]', async (form) => {
    const tokens = inputValue(form, 'tokens').split(/[\s,]+/).filter((token) => token !== '')
    if (tokens.length === 0) throw new Error('Enter at least one matric number')

    const added = await addVoters(electionId, tokens)
    if (added.totalAdded === 0 && added.notFound.length > 0) {
      throw new Error(`No matching users found: ${added.notFound.join(', ')}`)
    }
    const missing = added.notFound.length > 0 ? ` (${added.notFound.length} not found)` : ''
    return `Added ${added.totalAdded} voter(s)${missing}`
  })
}

/** One handler for every Remove button on the page: position, candidate or voter. */
function bindRemoves(root: HTMLElement, electionId: string): void {
  clickButtons(root, 'button[data-remove]', (button) => {
    const kind = button.dataset.remove
    const id = button.dataset.id ?? ''
    const name = button.dataset.name ?? ''

    if (kind === 'position') {
      if (!confirm(`Delete "${name}"?\n\nIts candidates will be removed too.`)) return
      runAction(button, 'Deleting…', async () => {
        await deletePosition(id)
        return 'Position deleted'
      })
    } else if (kind === 'candidate') {
      runAction(button, 'Removing…', async () => {
        await deleteCandidate(id)
        return `${name} removed`
      })
    } else if (kind === 'voter') {
      runAction(button, 'Removing…', async () => {
        await removeVoter(electionId, id)
        return `${name} removed from roll`
      })
    }
  })
}
