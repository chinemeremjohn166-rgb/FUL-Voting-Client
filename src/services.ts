import type {
  BallotReceipt,
  Candidate,
  Election,
  ElectionDetail,
  ElectionResults,
  ElectionStatus,
  Position,
  RollEntry,
  Selection,
} from './types'
import { api } from './api'

const V1 = '/api/v1'
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

const byOrder = (a: { order: number }, b: { order: number }): number => a.order - b.order

interface RawElection {
  id: string
  title: string
  description: string | null
  status: ElectionStatus
  startsAt: string
  endsAt: string
  publishedAt: string | null
  createdById: string
}

interface RawPosition {
  id: string
  electionId: string
  title: string
  seats: number
  order: number
  candidates?: Candidate[]
}

function mapElection(raw: RawElection): Election {
  return {
    id: raw.id,
    title: raw.title,
    description: raw.description ?? null,
    status: raw.status,
    startsAt: raw.startsAt,
    endsAt: raw.endsAt,
    publishedAt: raw.publishedAt ?? null,
    createdById: raw.createdById,
  }
}

function mapPosition(raw: RawPosition): Position {
  return {
    id: raw.id,
    electionId: raw.electionId,
    title: raw.title,
    seats: raw.seats,
    order: raw.order,
    candidates: [...(raw.candidates ?? [])].sort(byOrder),
  }
}

// ------------------------------------------------------------------ reads

export async function listElections(status?: ElectionStatus): Promise<Election[]> {
  const res = await api<{ elections: RawElection[] }>(
    `${V1}/elections${status ? `?status=${status}` : ''}`,
  )
  return res.elections.map(mapElection).sort((a, b) => b.startsAt.localeCompare(a.startsAt))
}

/** Null when the election does not exist or is a draft hidden from this user (API 404). */
export async function getElectionDetail(id: string): Promise<ElectionDetail | null> {
  try {
    const res = await api<{
      election: RawElection & { positions?: RawPosition[] }
      viewerStatus: { isEligible: boolean; hasVoted: boolean }
    }>(`${V1}/elections/${id}`)
    return {
      ...mapElection(res.election),
      positions: [...(res.election.positions ?? [])].sort(byOrder).map(mapPosition),
      viewerStatus: res.viewerStatus,
    }
  } catch (err) {
    if ((err as { status?: number }).status === 404) return null
    throw err
  }
}

export async function getResults(electionId: string): Promise<ElectionResults> {
  return api<ElectionResults>(`${V1}/elections/${electionId}/results`)
}

export interface VerifyResult {
  verified: boolean
  message: string
  electionId: string
  receiptCode: string
}

/** Public endpoint — no session needed, but it is scoped to one election. */
export async function verifyReceipt(electionId: string, receiptCode: string): Promise<VerifyResult> {
  return api<VerifyResult>(`${V1}/elections/${electionId}/verify/${encodeURIComponent(receiptCode.trim())}`)
}

interface RawRollEntry {
  userId: string
  addedAt: string
  user: { fullName: string; email: string; matricNo: string | null }
}

export async function listRoll(electionId: string): Promise<RollEntry[]> {
  const res = await api<{ voterRoll: RawRollEntry[] }>(`${V1}/elections/${electionId}/voters`)
  return res.voterRoll
    .map((entry) => ({
      userId: entry.userId,
      fullName: entry.user.fullName,
      email: entry.user.email,
      matricNo: entry.user.matricNo,
      addedAt: entry.addedAt,
    }))
    .sort((a, b) => a.fullName.localeCompare(b.fullName))
}

// ------------------------------------------------------------- own receipts

const RECEIPTS_KEY = 'ballotbox.receipts'

export function findMyReceipt(electionId: string): BallotReceipt | null {
  return listMyReceipts().find((r) => r.electionId === electionId) ?? null
}

export function listMyReceipts(): BallotReceipt[] {
  try {
    const parsed: unknown = JSON.parse(localStorage.getItem(RECEIPTS_KEY) ?? '[]')
    return Array.isArray(parsed) ? (parsed as BallotReceipt[]) : []
  } catch {
    return []
  }
}

export function saveMyReceipt(receipt: BallotReceipt): void {
  const others = listMyReceipts().filter((r) => r.electionId !== receipt.electionId)
  localStorage.setItem(RECEIPTS_KEY, JSON.stringify([...others, receipt]))
}

// ------------------------------------------------------------------ writes

export interface CastResult {
  receiptCode: string
  electionId: string
}

/** Abstentions are sent as `candidateId: null`. Throws ApiError (409 = already voted). */
export async function castBallot(electionId: string, selections: Selection[]): Promise<CastResult> {
  return api<CastResult>(`${V1}/elections/${electionId}/vote`, {
    method: 'POST',
    body: { selections },
  })
}

export async function createElection(input: {
  title: string
  description: string | null
  startsAt: string
  endsAt: string
}): Promise<Election> {
  const res = await api<{ election: RawElection }>(`${V1}/elections`, { method: 'POST', body: input })
  return mapElection(res.election)
}

export async function updateElection(
  id: string,
  patch: { title: string; description: string | null; startsAt: string; endsAt: string },
): Promise<Election> {
  const res = await api<{ election: RawElection }>(`${V1}/elections/${id}`, {
    method: 'PUT',
    body: patch,
  })
  return mapElection(res.election)
}

export async function transitionElection(id: string, status: ElectionStatus): Promise<ElectionStatus> {
  const res = await api<{ status: ElectionStatus }>(`${V1}/elections/${id}/status`, {
    method: 'PATCH',
    body: { status },
  })
  return res.status
}

export async function deleteElection(id: string): Promise<void> {
  await api(`${V1}/elections/${id}`, { method: 'DELETE' })
}

export async function addPosition(
  electionId: string,
  input: { title: string; seats: number },
): Promise<Position> {
  const res = await api<{ position: RawPosition }>(`${V1}/elections/${electionId}/positions`, {
    method: 'POST',
    body: input,
  })
  return mapPosition(res.position)
}

export async function deletePosition(id: string): Promise<void> {
  await api(`${V1}/elections/positions/${id}`, { method: 'DELETE' })
}

export async function addCandidate(
  positionId: string,
  input: { fullName: string; manifesto: string | null },
): Promise<Candidate> {
  const res = await api<{ candidate: Candidate }>(`${V1}/elections/${positionId}/candidates`, {
    method: 'POST',
    body: input,
  })
  return res.candidate
}

export async function deleteCandidate(id: string): Promise<void> {
  await api(`${V1}/elections/candidates/${id}`, { method: 'DELETE' })
}

export interface RollAddSummary {
  totalAdded: number
  alreadyOnRoll: number
  notFoundMatrics?: string[]
  notFoundUserIds?: string[]
}

/**
 * The API has no "list all users" endpoint, so voters are enrolled by matric
 * number — or by user id, which the roll itself exposes.
 */
export async function addToRoll(electionId: string, tokens: string[]): Promise<RollAddSummary> {
  const userIds = tokens.filter((t) => UUID_RE.test(t))
  const matricNumbers = tokens.filter((t) => !UUID_RE.test(t))
  return api<RollAddSummary>(`${V1}/elections/${electionId}/voters`, {
    method: 'POST',
    body: { userIds, matricNumbers },
  })
}

export async function removeFromRoll(electionId: string, userId: string): Promise<void> {
  await api(`${V1}/elections/${electionId}/voters/${userId}`, { method: 'DELETE' })
}
