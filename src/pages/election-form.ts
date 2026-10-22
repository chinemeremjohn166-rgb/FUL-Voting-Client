// The create/edit form for an election's own details. Used twice: when making a
// draft, and when saving changes to one. Validation happens here once, so both
// pages behave the same.

import { esc, field, setBusy } from '../ui'

export interface ElectionValues {
  title: string
  description: string | null
  startsAt: string
  endsAt: string
}

export function electionFormHtml(values: ElectionValues, submitLabel: string): string {
  return `<form class="stack-form" novalidate>
    ${field('Election title', `<input class="input" type="text" name="title" placeholder="e.g. 2026/2027 Student Union Government Elections" value="${esc(values.title)}">`)}
    ${field('Description', `<textarea class="input" name="description" rows="3" placeholder="What is this election about?">${esc(values.description)}</textarea>`)}
    <div class="form-row">
      ${field('Voting opens', `<input class="input" type="datetime-local" name="startsAt" value="${esc(values.startsAt)}">`)}
      ${field('Voting closes', `<input class="input" type="datetime-local" name="endsAt" value="${esc(values.endsAt)}">`)}
    </div>
    <p class="form-error" data-error role="alert" style="display:none"></p>
    <button class="btn primary" type="submit">${esc(submitLabel)}</button>
  </form>`
}

/**
 * Wires the form up. `save` is the one thing that differs between the two
 * pages: creating, or updating. Anything it throws is shown on the page.
 */
export function bindElectionForm(root: HTMLElement, save: (values: ElectionValues) => Promise<void>): void {
  const form = root.querySelector<HTMLFormElement>('form')
  const button = root.querySelector<HTMLButtonElement>('button[type=submit]')
  const errorLine = root.querySelector<HTMLElement>('[data-error]')
  if (!form || !button || !errorLine) return

  const fail = (message: string): void => {
    // Make the line visible first, then fill it: a screen reader reports text
    // that arrives inside an already-visible role="alert".
    errorLine.removeAttribute('style')
    errorLine.textContent = message
  }

  form.addEventListener('submit', (event) => {
    event.preventDefault()
    errorLine.setAttribute('style', 'display:none')

    const title = (form.elements.namedItem('title') as HTMLInputElement).value.trim()
    const description = (form.elements.namedItem('description') as HTMLTextAreaElement).value.trim()
    const startsAt = (form.elements.namedItem('startsAt') as HTMLInputElement).value
    const endsAt = (form.elements.namedItem('endsAt') as HTMLInputElement).value

    if (!title) return fail('A title is required.')
    if (title.length < 3) return fail('The title needs at least 3 characters.')
    if (!startsAt || !endsAt) return fail('Both dates are required.')
    if (new Date(endsAt).getTime() <= new Date(startsAt).getTime()) {
      return fail('Closing time must be after opening time.')
    }

    setBusy(button, true, 'Saving…')
    void save({ title, description: description || null, startsAt, endsAt }).then(
      () => setBusy(button, false),
      (error: Error) => {
        setBusy(button, false)
        fail(error.message || 'The server rejected this request.')
      },
    )
  })
}

/** Reload whatever the route shows, so the page matches the server again. */
export function reloadPage(): void {
  window.dispatchEvent(new HashChangeEvent('hashchange'))
}
