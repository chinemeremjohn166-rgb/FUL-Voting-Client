// Every call to the voting API lives in this one file.
// Each function below builds one URL, calls one fetch, and returns the JSON.
//
// The API runs on port 8000. The browser talks to it through the dev proxy set
// up in vite.config.ts, which is why every URL here starts with a plain "/api".

import {
  ApiError,
  BallotReceipt,
  Candidate,
  Election,
  ElectionDetail,
  ElectionResults,
  ElectionStatus,
  Position,
  RollEntry,
  Selection,
  User,
} from "./types";

const API = import.meta.env.BASE_URL + "/api/v1";
const TOKEN_KEY = "ballotbox.token";
const REQUEST_TIMEOUT_MS = 15000;

// --------------------------------------------------------------- the plumbing

export function getToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}

export function setToken(token: string | null): void {
  if (token) localStorage.setItem(TOKEN_KEY, token);
  else localStorage.removeItem(TOKEN_KEY);
}

/**
 * Shared code for every request: adds the headers, reads the JSON back, and
 * throws an Error carrying the server's own message when something went wrong.
 *
 * A 401 is not dealt with here. Tearing down a session means removing the token
 * *and* the saved user, and this file cannot do that without half-clearing it -
 * so whoever is waiting on the request decides: `checkSavedLogin` at boot,
 * `drawPage` on navigation.
 */
async function fetchJson(
  url: string,
  method = "GET",
  body?: unknown,
): Promise<any> {
  const headers: Record<string, string> = {};
  if (body !== undefined) headers["Content-Type"] = "application/json";

  const token = getToken();
  if (token) headers["Authorization"] = "Bearer " + token;

  // A request that never answers is worse than one that fails: the page would
  // stay dimmed forever. This timer gives up after a while instead.
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  let response: Response;
  try {
    response = await fetch(url, {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
      signal: controller.signal,
    });
  } catch (error: any) {
    if (error?.name === "AbortError")
      throw failed(
        0,
        "The voting server took too long to answer. Please try again.",
      );
    throw failed(
      0,
      "Cannot reach the voting server. Is it running on port 8000?",
    );
  } finally {
    clearTimeout(timer);
  }

  // 204 means "done, and there is nothing to send back".
  if (response.status === 204) return null;

  const data = await response.json().catch(() => null);

  if (!response.ok)
    throw failed(response.status, messageFor(response.status, data));

  return data;
}

/**
 * The sentence a user should read when a request fails.
 *
 * Usually that is the API's own message. But the dev proxy answers a dead
 * server with 502/504 and an empty body, and a plain number tells a beginner
 * nothing, so those cases get words instead.
 */
function messageFor(status: number, data: any): string {
  if (typeof data?.message === "string") return data.message;
  if (status === 502 || status === 504)
    return "Cannot reach the voting server. Is it running on port 8000?";
  if (status === 401)
    return "This sign-in is no longer valid. Please sign in again.";
  if (status === 403) return "This account is not allowed to do that.";
  return "Request failed (" + status + ")";
}

/** Builds the error object every failed request throws, with the status on it. */
function failed(status: number, message: string): ApiError {
  return Object.assign(new Error(message), { status });
}

/** The API has no "list all users" endpoint, so ids and matric numbers are told apart here. */
function looksLikeId(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
    value,
  );
}

/** The server already returns positions and candidates in `order` sequence; this keeps the page stable if that ever slips. */
function byOrder(list: { order: number }[]): void {
  list.sort((a, b) => a.order - b.order);
}

// ---------------------------------------------------------------------- auth

export async function login(
  identifier: string,
  password: string,
): Promise<User> {
  const data = await fetchJson(`${API}/auth/login`, "POST", {
    identifier: identifier.trim(),
    password,
  });
  setToken(data.token);
  return data.user;
}

export async function register(input: {
  fullName: string;
  email: string;
  matricNo: string | null;
  password: string;
}): Promise<User> {
  const data = await fetchJson(`${API}/auth/register`, "POST", {
    fullname: input.fullName, // the API really does spell this with a lowercase "n"
    email: input.email,
    matricNo: input.matricNo ?? undefined,
    password: input.password,
  });
  setToken(data.token);
  return data.user;
}

export async function readLoggedInUser(): Promise<User> {
  const data = await fetchJson(`${API}/auth/me`);
  return data.user;
}

export async function tellServerToLogOut(): Promise<void> {
  await fetchJson(`${API}/auth/logout`, "POST");
}

// ----------------------------------------------------------------- elections

/**
 * Every election this user may see. The server hands them back soonest-starting
 * first; the pages filter by status themselves, so there is only one request
 * even when the user clicks between the filter chips.
 */
export async function getElections(): Promise<Election[]> {
  const data = await fetchJson(`${API}/elections`);
  const elections: Election[] = data.elections;
  elections.sort((a, b) => b.startsAt.localeCompare(a.startsAt)); // newest opening first
  return elections;
}

/**
 * Gives back null when the election does not exist, or is a draft that this
 * user is not allowed to see (the API answers 404 for both on purpose).
 */
export async function getElection(id: string): Promise<ElectionDetail | null> {
  try {
    const data = await fetchJson(`${API}/elections/${id}`);
    const positions: Position[] = data.election.positions ?? [];
    byOrder(positions);
    for (const position of positions) byOrder(position.candidates);
    return { ...data.election, positions, viewerStatus: data.viewerStatus };
  } catch (error: any) {
    if (error.status === 404) return null;
    throw error;
  }
}

export async function createElection(input: {
  title: string;
  description: string | null;
  startsAt: string;
  endsAt: string;
}): Promise<Election> {
  const data = await fetchJson(`${API}/elections`, "POST", input);
  return data.election;
}

export async function updateElection(
  id: string,
  input: {
    title: string;
    description: string | null;
    startsAt: string;
    endsAt: string;
  },
): Promise<Election> {
  const data = await fetchJson(`${API}/elections/${id}`, "PUT", input);
  return data.election;
}

/** Moves an election along DRAFT -> OPEN -> CLOSED -> PUBLISHED. */
export async function changeStatus(
  id: string,
  status: ElectionStatus,
): Promise<ElectionStatus> {
  const data = await fetchJson(`${API}/elections/${id}/status`, "PATCH", {
    status,
  });
  return data.status;
}

export async function deleteElection(id: string): Promise<void> {
  await fetchJson(`${API}/elections/${id}`, "DELETE");
}

// --------------------------------------------- positions and candidates

export async function addPosition(
  electionId: string,
  title: string,
  seats: number,
): Promise<Position> {
  const data = await fetchJson(
    `${API}/elections/${electionId}/positions`,
    "POST",
    { title, seats },
  );
  return data.position;
}

export async function deletePosition(positionId: string): Promise<void> {
  await fetchJson(`${API}/elections/positions/${positionId}`, "DELETE");
}

export async function addCandidate(
  positionId: string,
  fullName: string,
  manifesto: string | null,
): Promise<Candidate> {
  const data = await fetchJson(
    `${API}/elections/${positionId}/candidates`,
    "POST",
    { fullName, manifesto },
  );
  return data.candidate;
}

export async function deleteCandidate(candidateId: string): Promise<void> {
  await fetchJson(`${API}/elections/candidates/${candidateId}`, "DELETE");
}

// --------------------------------------------------------------- voter roll

export async function getVoterRoll(electionId: string): Promise<RollEntry[]> {
  const data = await fetchJson(`${API}/elections/${electionId}/voters`);
  // Each row nests the voter inside it, so we pull the useful bits out.
  const roll: RollEntry[] = data.voterRoll.map((row: any) => ({
    userId: row.userId,
    fullName: row.user.fullName,
    email: row.user.email,
    matricNo: row.user.matricNo,
    addedAt: row.addedAt,
  }));
  roll.sort((a, b) => a.fullName.localeCompare(b.fullName));
  return roll;
}

/** Sends one batch of matric numbers (or user ids) and reports how many stuck. */
export async function addVoters(
  electionId: string,
  tokens: string[],
): Promise<{ totalAdded: number; notFound: string[] }> {
  const userIds = tokens.filter(looksLikeId);
  const matricNumbers = tokens.filter((token) => !looksLikeId(token));
  const data = await fetchJson(
    `${API}/elections/${electionId}/voters`,
    "POST",
    { userIds, matricNumbers },
  );
  return {
    totalAdded: data.totalAdded,
    notFound: [
      ...(data.notFoundMatrics ?? []),
      ...(data.notFoundUserIds ?? []),
    ],
  };
}

export async function removeVoter(
  electionId: string,
  userId: string,
): Promise<void> {
  await fetchJson(`${API}/elections/${electionId}/voters/${userId}`, "DELETE");
}

// ------------------------------------------------------------------- voting

/**
 * One entry per choice. A blank vote is sent as `candidateId: null`.
 * Returns the receipt code the server issued.
 */
export async function castBallot(
  electionId: string,
  selections: Selection[],
): Promise<BallotReceipt> {
  const data = await fetchJson(`${API}/elections/${electionId}/vote`, "POST", {
    selections,
  });
  return {
    electionId: data.electionId,
    receiptCode: data.receiptCode,
    castAt: new Date().toISOString(),
  };
}

/** Public, but always scoped to one election. Throws when the code is unknown. */
export async function verifyReceipt(
  electionId: string,
  code: string,
): Promise<{
  verified: boolean;
  message: string;
  electionId: string;
  receiptCode: string;
}> {
  return fetchJson(
    `${API}/elections/${electionId}/verify/${encodeURIComponent(code.trim())}`,
  );
}

export async function getResults(electionId: string): Promise<ElectionResults> {
  return fetchJson(`${API}/elections/${electionId}/results`);
}
