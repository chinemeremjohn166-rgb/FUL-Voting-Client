// Receipt codes are kept in this browser only.
//
// The API deliberately never tells us "which ballots did this user cast" — a
// ballot is stored anonymously, so there is nothing to ask for. The receipt you
// are shown after voting is remembered here instead, which is what lets the
// receipt page and the verify page find your own codes later.

import { BallotReceipt } from './types'

const RECEIPTS_KEY = 'ballotbox.receipts'

export function loadReceipts(): BallotReceipt[] {
  try {
    const parsed = JSON.parse(localStorage.getItem(RECEIPTS_KEY) ?? '[]')
    if (!Array.isArray(parsed)) return []
    // localStorage can be corrupt or hand-edited, so only entries that really
    // look like receipts are allowed through.
    return parsed.filter(
      (item): item is BallotReceipt =>
        typeof item?.electionId === 'string' &&
        typeof item?.receiptCode === 'string' &&
        typeof item?.castAt === 'string',
    )
  } catch {
    return []
  }
}

export function findReceipt(electionId: string): BallotReceipt | null {
  return loadReceipts().find((receipt) => receipt.electionId === electionId) ?? null
}

export function saveReceipt(receipt: BallotReceipt): void {
  const others = loadReceipts().filter((item) => item.electionId !== receipt.electionId)
  localStorage.setItem(RECEIPTS_KEY, JSON.stringify([...others, receipt]))
}

export function clearReceipts(): void {
  localStorage.removeItem(RECEIPTS_KEY)
}

/** Used by the verify page: does a code we typed belong to a ballot cast here? */
export function findElectionOfCode(code: string): string | null {
  // Codes are compared the way the API compares them: capitals only.
  const wanted = code.trim().toUpperCase()
  const match = loadReceipts().find((receipt) => receipt.receiptCode.toUpperCase() === wanted)
  return match ? match.electionId : null
}
