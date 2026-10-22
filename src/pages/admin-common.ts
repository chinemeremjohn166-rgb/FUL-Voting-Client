// The parts both admin pages need: the words on each status button, and the
// small helpers that make "press a button, wait for the server, refresh" feel
// the same everywhere.

import { changeStatus, deleteElection } from '../api'
import { Election, ElectionStatus } from '../types'
import { esc, icon, setBusy, toast } from '../ui'
import { reloadPage } from './election-form'

/** An election only ever moves forward, so each status has at most one next step. */
const NEXT_STATUS: Record<ElectionStatus, ElectionStatus | null> = {
  DRAFT: 'OPEN',
  OPEN: 'CLOSED',
  CLOSED: 'PUBLISHED',
  PUBLISHED: null,
}

/** What the button says, how it looks, and what it warns about first. */
const TRANSITION_TEXT: Record<ElectionStatus, { label: string; busy: string; done: string; className: string; warning: string } | null> = {
  DRAFT: {
    label: 'Open voting',
    busy: 'Opening voting…',
    done: 'Voting is open',
    className: 'primary',
    warning: 'Once open, the ballot, positions, candidates and voter roll become immutable.',
  },
  OPEN: {
    label: 'Close voting',
    busy: 'Closing voting…',
    done: 'Voting is closed',
    className: 'danger',
    warning: 'Closing ends voting immediately. Ballots already cast remain counted.',
  },
  CLOSED: {
    label: 'Publish results',
    busy: 'Publishing results…',
    done: 'Results are published',
    className: 'primary',
    warning: 'Published results become visible to every user. This transition is final.',
  },
  PUBLISHED: null,
}

export function transitionButtonHtml(election: Election): string {
  const text = TRANSITION_TEXT[election.status]
  const next = NEXT_STATUS[election.status]
  if (!text || !next) return ''
  // `data-from` is the status the button was drawn for, so the click handler
  // reads the words straight off it instead of searching back through NEXT_STATUS.
  return `<button class="btn ${text.className} sm" type="button" data-transition="${esc(next)}" data-from="${esc(election.status)}" data-id="${esc(election.id)}" data-title="${esc(election.title)}">${esc(text.label)}</button>`
}

export function previewResultsButtonHtml(election: Election): string {
  if (election.status !== 'CLOSED') return ''
  return `<a class="btn ghost sm" href="#/elections/${esc(election.id)}/results">${icon('chart', 15)} Preview results</a>`
}

export function deleteElectionButtonHtml(election: Election): string {
  if (election.status !== 'DRAFT') return ''
  return `<button class="btn danger-outline sm" type="button" data-delete-election="${esc(election.id)}" data-name="${esc(election.title)}">${icon('trash', 15)} Delete</button>`
}

/**
 * Runs `work` with the button dimmed so it cannot be pressed twice, shows the
 * message it hands back as a toast, then asks the server for a fresh copy of
 * the page. A thrown error is shown instead of the success toast.
 */
export function runAction(button: HTMLButtonElement, busyLabel: string, work: () => Promise<string>): void {
  if (button.disabled) return
  setBusy(button, true, busyLabel)
  void work().then(
    (message) => {
      toast(message, 'success')
      reloadPage()
    },
    (error: Error) => {
      setBusy(button, false)
      toast(error.message || 'The server rejected this request.', 'error')
    },
  )
}

/**
 * Attaches one click handler to every button that matches `selector`, so a page
 * can say "for each of these buttons, do this".
 */
export function clickButtons(root: HTMLElement, selector: string, handler: (button: HTMLButtonElement) => void): void {
  const buttons = root.querySelectorAll<HTMLButtonElement>(selector)
  for (const button of buttons) {
    button.addEventListener('click', () => handler(button))
  }
}

/** The pair of buttons that moves an election to its next status, with a yes/no first. */
export function bindTransitions(root: HTMLElement): void {
  clickButtons(root, 'button[data-transition]', (button) => {
    const status = button.dataset.transition as ElectionStatus
    const text = TRANSITION_TEXT[button.dataset.from as ElectionStatus]
    if (!text) return
    const title = button.dataset.title ?? 'this election'
    if (!confirm(`${text.label} — "${title}"?\n\n${text.warning}`)) return
    runAction(button, text.busy, async () => {
      await changeStatus(button.dataset.id ?? '', status)
      return `${text.done} — "${title}"`
    })
  })
}

/**
 * Deleting a draft, after a yes/no first. `whenGone` differs per page: the
 * dashboard just asks for its list again, while the manage page has to leave.
 */
export function bindElectionDeletes(root: HTMLElement, whenGone: () => void): void {
  clickButtons(root, 'button[data-delete-election]', (button) => {
    const electionId = button.dataset.deleteElection ?? ''
    const name = button.dataset.name ?? 'this election'
    if (!confirm(`Delete "${name}"?\n\nThis permanently removes the election, its positions, candidates and voter roll.`)) return

    setBusy(button, true, 'Deleting…')
    void deleteElection(electionId).then(
      () => {
        toast('Election deleted', 'success')
        whenGone()
      },
      (error: Error) => {
        setBusy(button, false)
        toast(error.message || 'The server rejected this request.', 'error')
      },
    )
  })
}
