// Shown right after voting, and reachable again later from this browser,
// because the receipt code was saved locally (see receipts.ts).

import { getElection } from '../api'
import { findReceipt } from '../receipts'
import { Page } from '../types'
import { banner, copyText, esc, formatDateTime, icon, pageHead } from '../ui'

export function receiptPage(electionId: string): Page {
  return {
    title: 'Ballot Receipt',

    async render() {
      const receipt = findReceipt(electionId)
      const detail = await getElection(electionId)

      if (!receipt || !detail) {
        return `${pageHead('No receipt found')}
          ${banner('error', 'No ballot cast from this browser is recorded for this election.')}
          <a class="btn ghost" href="#/elections">${icon('arrowLeft', 15)} Back to elections</a>`
      }

      const verifyLink = `#/verify?code=${encodeURIComponent(receipt.receiptCode)}&election=${encodeURIComponent(receipt.electionId)}`

      return `<div class="receipt-page"><div class="card receipt-card">
        <span class="receipt-icon">${icon('check', 36)}</span>
        <h1>Ballot cast</h1>
        <p class="muted">Your ballot in "${esc(detail.title)}" was recorded anonymously.</p>
        <div class="receipt-code-row">
          <code class="receipt-code" data-code>${esc(receipt.receiptCode)}</code>
          <button class="btn ghost" type="button" data-copy>${icon('copy', 15)} Copy</button>
        </div>
        <p class="muted sm-text">Cast ${formatDateTime(receipt.castAt)}</p>
        ${banner('info', 'Keep this code private. It proves that a ballot was cast, but the system deliberately stores no link between this receipt and your choices.')}
        <div class="receipt-actions">
          <a class="btn primary" href="${verifyLink}">${icon('search', 15)} Verify this receipt</a>
          <a class="btn ghost" href="#/elections">Back to elections</a>
        </div>
      </div></div>`
    },

    bind(root) {
      const button = root.querySelector('[data-copy]')
      const code = root.querySelector('[data-code]')
      if (!button || !code) return
      button.addEventListener('click', () => void copyText(code.textContent ?? ''))
    },
  }
}
