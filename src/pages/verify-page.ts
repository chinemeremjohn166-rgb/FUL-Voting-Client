// Anyone can use this page: it proves a receipt code was counted, without
// revealing what the ballot contained. Verification is scoped to one election,
// so the election has to be chosen too.

import { getElections, verifyReceipt } from '../api'
import { getUser } from '../session'
import { findElectionOfCode } from '../receipts'
import { Page } from '../types'
import { banner, copyText, esc, field, icon, pageHead, setBusy } from '../ui'

export function verifyPage(codeFromLink: string, electionFromLink: string): Page {
  const signedIn = getUser() !== null
  const titles = new Map<string, string>()

  return {
    title: 'Verify Receipt',

    async render() {
      let options = '<option value="">Sign in to choose an election</option>'
      let canChoose = false

      if (signedIn) {
        const elections = await getElections()
        options = '<option value="">Which election was this ballot cast in?</option>'
        for (const election of elections) {
          titles.set(election.id, election.title)
          options += `<option value="${esc(election.id)}"${election.id === electionFromLink ? ' selected' : ''}>${esc(election.title)} · ${esc(election.status)}</option>`
        }
        canChoose = true
      } else if (electionFromLink) {
        // The link on a receipt page already names the election, so somebody
        // checking a code they were handed — on another device, unsigned in —
        // can use this page too.
        titles.set(electionFromLink, 'The election from your receipt link')
        options = `<option value="${esc(electionFromLink)}" selected>Election from your receipt link</option>`
        canChoose = true
      }

      const notice = signedIn || electionFromLink
        ? ''
        : banner('info', 'The verify endpoint is public, but it is scoped to one election. Open the link from your receipt page, or sign in to pick an election.')

      return `<div class="verify-page">
        ${pageHead('Verify a receipt', 'Anyone can confirm a ballot was counted — without learning what it contained.')}
        ${notice}
        <div class="card">
          <form class="verify-form" novalidate>
            ${field('Receipt code', `<input class="input mono-input" type="text" name="code" spellcheck="false" placeholder="REC-XXXX-XXXXXXXXXXXXXXXX" value="${esc(codeFromLink)}">`, 'Receipts look like REC-XXXX-XXXXXXXXXXXXXXXX and were shown right after casting a ballot.')}
            ${field('Election', `<select class="input" name="election"${canChoose ? '' : ' disabled'}>${options}</select>`)}
            <button class="btn primary" type="submit">${icon('search', 15)} Verify receipt</button>
          </form>
        </div>
        <div data-result aria-live="polite"></div>
      </div>`
    },

    bind(root) {
      const form = root.querySelector('form')
      const codeInput = root.querySelector<HTMLInputElement>('input[name=code]')
      const electionSelect = root.querySelector<HTMLSelectElement>('select[name=election]')
      const resultBox = root.querySelector<HTMLElement>('[data-result]')
      const button = root.querySelector<HTMLButtonElement>('button[type=submit]')
      if (!form || !codeInput || !electionSelect || !resultBox || !button) return

      // Codes are written in capitals, so keep whatever is typed in capitals.
      codeInput.addEventListener('input', () => {
        codeInput.value = codeInput.value.toUpperCase()
        // A ballot cast in this browser already knows its own election, so the
        // lookup can be filled in even for a visitor who is not signed in.
        const localElection = findElectionOfCode(codeInput.value.trim())
        if (localElection && !electionSelect.value) {
          const option = document.createElement('option')
          option.value = localElection
          option.textContent = 'One of my ballots'
          electionSelect.appendChild(option)
          electionSelect.value = localElection
        }
      })

      form.addEventListener('submit', (event) => {
        event.preventDefault()
        void runLookup()
      })

      const runLookup = async (): Promise<void> => {
        const code = codeInput.value.trim()
        const electionId = electionSelect.value

        if (!code) return void (resultBox.innerHTML = banner('warn', 'Enter a receipt code first.'))
        if (!electionId) {
          return void (resultBox.innerHTML = banner('warn', 'Verification is scoped to one election — choose which election this ballot was cast in.'))
        }

        setBusy(button, true, 'Checking…')
        resultBox.innerHTML = banner('info', 'Checking the ballot ledger…')
        try {
          const result = await verifyReceipt(electionId, code)
          resultBox.innerHTML = `<div class="card verify-result verify-ok">
            <span class="verify-icon">${icon('check', 28)}</span>
            <h3>Receipt verified</h3>
            <p class="muted">${esc(result.message)}</p>
            <div class="verify-rows">
              <div class="verify-row"><span>Receipt code</span><code class="receipt-code">${esc(result.receiptCode)}</code></div>
              <div class="verify-row"><span>Election</span><strong>${esc(titles.get(result.electionId) ?? result.electionId)}</strong></div>
            </div>
            <button class="btn ghost sm" type="button" data-copy-code>${icon('copy', 15)} Copy code</button>
          </div>`
          const copyButton = resultBox.querySelector('[data-copy-code]')
          copyButton?.addEventListener('click', () => void copyText(result.receiptCode))
        } catch (error: any) {
          // Only a 404 means the ledger has no such ballot. A 429, a timeout or
          // a dead server says nothing about the receipt, so saying "not found"
          // would tell the voter their ballot is missing when it may be fine.
          const status = error?.status
          const title = status === 404 ? 'Receipt not found' : 'Could not check this receipt'
          const advice =
            status === 404
              ? 'No ballot matches this code in that election. Check for typos — receipt codes must be exact.'
              : status === 429
                ? 'Too many checks from this address. Wait a few minutes and try again.'
                : status === 0 || status === 502 || status === 504
                  ? 'The voting server did not answer. Your ballot is untouched — try again once the server is running.'
                  : 'The server reported a problem. Your ballot is untouched — try again.'

          resultBox.innerHTML = `<div class="card verify-result verify-fail">
            <span class="verify-icon">${icon(status === 404 ? 'x' : 'alert', 28)}</span>
            <h3>${esc(title)}</h3>
            <p class="muted">${esc(error?.message || advice)}</p>
            ${error?.message && status !== 404 ? `<p class="muted">${esc(advice)}</p>` : ''}
          </div>`
        } finally {
          setBusy(button, false)
        }
      }

      // Coming from a receipt link means both parts are already known.
      if (codeFromLink && electionFromLink) void runLookup()
    },
  }
}
