// Every shape here mirrors what the voting API sends back, so you can read this
// file next to the API's controllers and match them up.

/** A failed request. `status` is the HTTP code, or 0 when the server was unreachable. */
export interface ApiError extends Error {
  status: number
  data?: any
}

export type Role = 'VOTER' | 'ADMIN'

export type ElectionStatus = 'DRAFT' | 'OPEN' | 'CLOSED' | 'PUBLISHED'

export interface User {
  id: string
  email: string
  fullName: string
  matricNo: string | null
  role: Role
  isVerified?: boolean
}

export interface RegisterResult {
  message: string
  requiresVerification: boolean
  email: string
  token?: string
  user?: User
}

export interface Candidate {
  id: string
  positionId: string
  fullName: string
  manifesto: string | null
  photoUrl: string | null
  order: number
}

export interface Position {
  id: string
  electionId: string
  title: string
  seats: number
  order: number
  candidates: Candidate[]
}

export interface Election {
  id: string
  title: string
  description: string | null
  status: ElectionStatus
  startsAt: string
  endsAt: string
  publishedAt: string | null
  createdById: string
}

export interface ElectionDetail extends Election {
  positions: Position[]
  viewerStatus: {
    isEligible: boolean
    hasVoted: boolean
  }
}

// Receipts live in localStorage: the API deliberately offers no lookup of a
// voter's own ballots, because ballots are never linked to an identity.
export interface BallotReceipt {
  electionId: string
  receiptCode: string
  castAt: string
}

export interface Selection {
  positionId: string
  /** null = abstain / blank vote */
  candidateId: string | null
}

export interface Turnout {
  registeredVoters: number
  ballotsCast: number
  /** API formats this as a string already carrying the percent sign, e.g. "75.00%". */
  turnoutPercentage: string
}

export interface CandidateResult {
  id: string
  fullName: string
  photoUrl: string | null
  voteCount: number
  /** API returns a string such as "66.67%". */
  percentage: string
}

export interface PositionResult {
  positionId: string
  title: string
  seats: number
  totalVotes: number
  blankVotes: number
  candidates: CandidateResult[]
  /** API returns the full candidate objects of the seated winners, not ids. */
  winners: CandidateResult[]
  hasTie: boolean
}

export interface ElectionResults {
  election: {
    id: string
    title: string
    status: ElectionStatus
    publishedAt: string | null
  }
  turnout: Turnout
  results: PositionResult[]
}

export interface RollEntry {
  userId: string
  fullName: string
  email: string
  matricNo: string | null
  addedAt: string
}

/**
 * A page in this app is just an object with three parts: a title for the browser
 * tab, a render() that fetches what it needs and returns HTML text, and an
 * optional bind() that attaches event listeners once that HTML is on the page.
 */
export interface Page {
  title: string
  render: () => Promise<string>
  bind?: (root: HTMLElement) => void
}
