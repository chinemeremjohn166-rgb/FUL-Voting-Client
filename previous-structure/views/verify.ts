import type { Route } from '../router'
import { getSession } from '../state'
import { listElections, listMyReceipts, verifyReceipt } from '../services'
import { banner, copyText, field, h, icon, pageHead, setBusy } from '../ui'

export function renderVerify(route: Route): HTMLElement {
  const presetCode = (route.query.get('code') ?? '').toUpperCase()
  const presetElection = route.query.get('election') ?? ''

  const input = h('input', {
    class: 'input mono-input',
    type: 'text',
    placeholder: 'REC-XXXX-XXXXXXXXXXXXXXXX',
    value: presetCode,
    spellcheck: 'false',
  }) as HTMLInputElement

  const electionSelect = h('select', { class: 'input' }) as HTMLSelectElement
  const resultEl = h('div', {})
  const verifyBtn = h('button', { class: 'btn primary', type: 'submit' }, icon('search', 15), ' Verify receipt') as HTMLButtonElement

  const signedIn = getSession() !== null
  const titles = new Map<string, string>()

  if (signedIn) {
    electionSelect.append(h('option', { value: '', text: 'Loading elections…' }))
    void listElections().then((all) => {
      for (const e of all) titles.set(e.id, e.title)
      electionSelect.replaceChildren(
        h('option', { value: '', text: 'Which election was this ballot cast in?' }),
        ...all.map((e) => h('option', { value: e.id, text: `${e.title} · ${e.status}` })),
      )
      if (presetElection) electionSelect.value = presetElection
    }).catch(() => {
      electionSelect.replaceChildren(h('option', { value: '', text: 'Election list unavailable' }))
    })
  } else {
    electionSelect.append(h('option', { value: '', text: 'Sign in to choose an election' }))
    electionSelect.toggleAttribute('disabled', true)
  }

  input.addEventListener('input', () => {
    input.value = input.value.toUpperCase()
    // A code cast in this browser knows its own election, so the lookup works
    // even for visitors who are not signed in.
    const local = listMyReceipts().find((r) => r.receiptCode === input.value.trim())
    if (local && !electionSelect.value) {
      electionSelect.append(h('option', { value: local.electionId, text: 'One of my ballots' }))
      electionSelect.value = local.electionId
    }
  })

  let busy = false

  async function runLookup(): Promise<void> {
    if (busy) return
    const code = input.value.trim()
    const electionId = electionSelect.value
    if (!code) {
      resultEl.replaceChildren(banner('warn', 'Enter a receipt code first.'))
      return
    }
    if (!electionId) {
      resultEl.replaceChildren(banner('warn', 'Verification is scoped to one election — choose which election this ballot was cast in.'))
      return
    }

    busy = true
    setBusy(verifyBtn, true, 'Checking…')
    resultEl.replaceChildren(banner('info', 'Checking the ballot ledger…'))
    try {
      const result = await verifyReceipt(electionId, code)
      resultEl.replaceChildren(
        h('div', { class: 'card verify-result verify-ok' },
          h('span', { class: 'verify-icon' }, icon('check', 28)),
          h('h3', { text: 'Receipt verified' }),
          h('p', { class: 'muted', text: result.message }),
          h('div', { class: 'verify-rows' },
            h('div', { class: 'verify-row' }, h('span', { text: 'Receipt code' }), h('code', { class: 'receipt-code', text: result.receiptCode })),
            h('div', { class: 'verify-row' }, h('span', { text: 'Election' }), h('strong', { text: titles.get(result.electionId) ?? result.electionId })),
          ),
          h('button', { class: 'btn ghost sm', type: 'button', onClick: () => void copyText(result.receiptCode) }, icon('copy', 15), ' Copy code'),
        ),
      )
    } catch (err) {
      resultEl.replaceChildren(
        h('div', { class: 'card verify-result verify-fail' },
          h('span', { class: 'verify-icon' }, icon('x', 28)),
          h('h3', { text: 'Receipt not found' }),
          h('p', {
            class: 'muted',
            text: err instanceof Error && err.message
              ? err.message
              : 'No ballot matches this code. Check for typos — receipt codes are case-insensitive but must be exact.',
          }),
        ),
      )
    } finally {
      busy = false
      setBusy(verifyBtn, false)
    }
  }

  const form = h('form', { class: 'verify-form', novalidate: 'novalidate' },
    field('Receipt code', input, 'Receipts look like REC-XXXX-XXXXXXXXXXXXXXXX and were shown right after casting a ballot.'),
    field('Election', electionSelect),
    verifyBtn,
  )
  form.addEventListener('submit', (e) => {
    e.preventDefault()
    void runLookup()
  })

  const notice = signedIn || presetElection
    ? undefined
    : banner('info', 'The verify endpoint is public, but it is scoped to one election. Open the link from your receipt page, or sign in to pick an election.')

  const page = h('div', { class: 'verify-page' },
    pageHead('Verify a receipt', 'Anyone can confirm a ballot was counted — without learning what it contained.'),
    notice,
    h('div', { class: 'card' }, form),
    resultEl,
  )

  if (presetCode && presetElection) void runLookup()
  return page
}
