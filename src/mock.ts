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
  User,
} from './types'

// ---------------------------------------------------------------- helpers

const HOUR = 3_600_000
const DAY = 24 * HOUR
const NOW = Date.now()
const iso = (t: number) => new Date(t).toISOString()
const daysAgo = (n: number, hourOffset = 0) => iso(NOW - n * DAY + hourOffset * HOUR)
const daysFromNow = (n: number, hourOffset = 0) => iso(NOW + n * DAY + hourOffset * HOUR)

// ------------------------------------------------------------------ users

export const users: User[] = [
  { id: 'u-admin', email: 'a.yusuf@ballot.edu', fullName: 'Dr. Amina Yusuf', matricNo: null, role: 'ADMIN' },
  { id: 'u-chidi', email: 'chidi@student.edu', fullName: 'Chidi Okafor', matricNo: 'CSC/2023/001', role: 'VOTER' },
  { id: 'u-amara', email: 'amara@student.edu', fullName: 'Amara Nwosu', matricNo: 'CSC/2023/014', role: 'VOTER' },
  { id: 'u-tunde', email: 'tunde@student.edu', fullName: 'Tunde Balogun', matricNo: 'CSC/2023/022', role: 'VOTER' },
  { id: 'u-fatima', email: 'fatima@student.edu', fullName: 'Fatima Bello', matricNo: 'CSC/2023/031', role: 'VOTER' },
  { id: 'u-emeka', email: 'emeka@student.edu', fullName: 'Emeka Obi', matricNo: 'CSC/2022/007', role: 'VOTER' },
  { id: 'u-ngozi', email: 'ngozi@student.edu', fullName: 'Ngozi Eze', matricNo: 'CSC/2024/045', role: 'VOTER' },
  { id: 'u-seun', email: 'seun@student.edu', fullName: 'Seun Adeyemi', matricNo: 'CSC/2024/052', role: 'VOTER' },
  { id: 'u-kemi', email: 'kemi@student.edu', fullName: 'Kemi Adebayo', matricNo: 'CSC/2022/019', role: 'VOTER' },
  { id: 'u-yusuf', email: 'yusuf@student.edu', fullName: 'Yusuf Garba', matricNo: 'CSC/2023/040', role: 'VOTER' },
  { id: 'u-hauwa', email: 'hauwa@student.edu', fullName: 'Hauwa Abdullahi', matricNo: 'CSC/2024/011', role: 'VOTER' },
  { id: 'u-peter', email: 'peter@student.edu', fullName: 'Peter Obioma', matricNo: 'CSC/2022/033', role: 'VOTER' },
]

export function getUserById(id: string): User | undefined {
  return users.find((u) => u.id === id)
}

export function listUsers(): User[] {
  return [...users]
}

/** Login accepts email or matric number (mirrors the API's identifier field). */
export function authenticate(identifier: string): User | null {
  const id = identifier.toLowerCase()
  return users.find((u) => u.email.toLowerCase() === id || (u.matricNo !== null && u.matricNo === identifier.toUpperCase())) ?? null
}

export function registerUser(input: { fullName: string; email: string; matricNo: string | null }): User | { error: string } {
  const email = input.email.trim().toLowerCase()
  if (users.some((u) => u.email.toLowerCase() === email)) return { error: 'An account with this email already exists.' }
  const matricNo = input.matricNo ? input.matricNo.trim().toUpperCase() : null
  if (matricNo && users.some((u) => u.matricNo === matricNo)) return { error: 'An account with this matric number already exists.' }
  const user: User = { id: `u-${crypto.randomUUID().slice(0, 8)}`, fullName: input.fullName.trim(), email, matricNo, role: 'VOTER' }
  users.push(user)
  return user
}

// -------------------------------------------------------------- elections

export const elections: Election[] = [
  {
    id: 'elec-sug-2027',
    title: '2026/2027 Student Union Government Elections',
    description: 'Annual general election for the Student Union Government executive offices. Every registered student on the voter roll may cast one secret ballot per office.',
    status: 'OPEN',
    startsAt: daysAgo(2),
    endsAt: daysFromNow(5),
    publishedAt: null,
    createdById: 'u-admin',
  },
  {
    id: 'elec-fac-week',
    title: 'Science Faculty Week Planning Committee',
    description: 'Election of the planning committee for the annual faculty week celebrations. Two committee chair positions are available.',
    status: 'OPEN',
    startsAt: daysAgo(1),
    endsAt: daysFromNow(1, -2),
    publishedAt: null,
    createdById: 'u-admin',
  },
  {
    id: 'elec-pg-rep',
    title: 'Postgraduate Students Representative By-Election',
    description: 'By-election to fill the vacant postgraduate representative seat on the student council.',
    status: 'OPEN',
    startsAt: daysAgo(3),
    endsAt: daysFromNow(4),
    publishedAt: null,
    createdById: 'u-admin',
  },
  {
    id: 'elec-sports-dept',
    title: 'Departmental Sports Committee Election',
    description: 'Elects the departmental sports committee responsible for inter-departmental competitions.',
    status: 'CLOSED',
    startsAt: daysAgo(10),
    endsAt: daysAgo(1),
    publishedAt: null,
    createdById: 'u-admin',
  },
  {
    id: 'elec-sug-2026',
    title: '2025/2026 SUG Elections — Final Results',
    description: 'The concluded 2025/2026 Student Union Government elections. Results have been audited and published.',
    status: 'PUBLISHED',
    startsAt: daysAgo(100),
    endsAt: daysAgo(93),
    publishedAt: daysAgo(90),
    createdById: 'u-admin',
  },
  {
    id: 'elec-pro-bye',
    title: 'PRO By-Election 2026/2027',
    description: 'Draft by-election for the Public Relations Officer position. Configure positions, candidates and the voter roll, then open the election.',
    status: 'DRAFT',
    startsAt: daysFromNow(10),
    endsAt: daysFromNow(13),
    publishedAt: null,
    createdById: 'u-admin',
  },
]

// positions carry no nested candidates here; getDetail() joins them in.

export const positions: Position[] = [
  // SUG 2026/27 (open)
  { id: 'pos-pres', electionId: 'elec-sug-2027', title: 'President', seats: 1, order: 1, candidates: [] },
  { id: 'pos-vp', electionId: 'elec-sug-2027', title: 'Vice President', seats: 1, order: 2, candidates: [] },
  { id: 'pos-gensec', electionId: 'elec-sug-2027', title: 'General Secretary', seats: 1, order: 3, candidates: [] },
  { id: 'pos-sport', electionId: 'elec-sug-2027', title: 'Sports Director', seats: 1, order: 4, candidates: [] },
  { id: 'pos-social', electionId: 'elec-sug-2027', title: 'Social Director', seats: 2, order: 5, candidates: [] },
  { id: 'pos-pro', electionId: 'elec-sug-2027', title: 'Public Relations Officer', seats: 1, order: 6, candidates: [] },
  // Faculty week (open, current user has voted)
  { id: 'pos-chair', electionId: 'elec-fac-week', title: 'Committee Chair', seats: 2, order: 1, candidates: [] },
  { id: 'pos-pub', electionId: 'elec-fac-week', title: 'Publicity Lead', seats: 1, order: 2, candidates: [] },
  // PG rep (open, current user NOT on roll)
  { id: 'pos-pgrep', electionId: 'elec-pg-rep', title: 'Postgraduate Representative', seats: 1, order: 1, candidates: [] },
  // Sports dept (closed)
  { id: 'pos-capt', electionId: 'elec-sports-dept', title: 'Team Captain', seats: 1, order: 1, candidates: [] },
  { id: 'pos-asstcapt', electionId: 'elec-sports-dept', title: 'Assistant Captain', seats: 1, order: 2, candidates: [] },
  // SUG 2025/26 (published)
  { id: 'pos-ppres', electionId: 'elec-sug-2026', title: 'President', seats: 1, order: 1, candidates: [] },
  { id: 'pos-pvp', electionId: 'elec-sug-2026', title: 'Vice President', seats: 1, order: 2, candidates: [] },
  { id: 'pos-pgensec', electionId: 'elec-sug-2026', title: 'General Secretary', seats: 1, order: 3, candidates: [] },
  { id: 'pos-psocial', electionId: 'elec-sug-2026', title: 'Social Director', seats: 2, order: 4, candidates: [] },
  { id: 'pos-ppro', electionId: 'elec-sug-2026', title: 'Public Relations Officer', seats: 1, order: 5, candidates: [] },
  // PRO by-election (draft)
  { id: 'pos-npro', electionId: 'elec-pro-bye', title: 'Public Relations Officer', seats: 1, order: 1, candidates: [] },
  { id: 'pos-nsocial', electionId: 'elec-pro-bye', title: 'Deputy Social Director', seats: 1, order: 2, candidates: [] },
]

export const candidates: Candidate[] = [
  // President
  { id: 'cand-adaeze', positionId: 'pos-pres', fullName: 'Adaeze Okonkwo', manifesto: 'I will push for a 24-hour library during exams, transparent SUG budgets published every month, and a shuttle bus service between hostels and lecture halls.', photoUrl: null, order: 1 },
  { id: 'cand-ibrahim', positionId: 'pos-pres', fullName: 'Ibrahim Musa', manifesto: 'My administration will prioritise student welfare: subsidised feeding programmes, faster clinic referrals, and a real voice for students in faculty decisions.', photoUrl: null, order: 2 },
  { id: 'cand-kelechi', positionId: 'pos-pres', fullName: 'Kelechi Anyanwu', manifesto: 'Unity first. I will bridge the gap between the union and the student body through quarterly town halls and an open-door office policy.', photoUrl: null, order: 3 },
  // VP
  { id: 'cand-bola', positionId: 'pos-vp', fullName: 'Bola Adeleke', manifesto: 'I bring three years of departmental experience. My focus is academic support: peer tutoring networks and past-question archives for every course.', photoUrl: null, order: 1 },
  { id: 'cand-nnamdi', positionId: 'pos-vp', fullName: 'Nnamdi Eze', manifesto: 'I will modernise the union\'s communication channels and make sure every faculty has a dedicated student representative.', photoUrl: null, order: 2 },
  // Gen Sec
  { id: 'cand-funmi', positionId: 'pos-gensec', fullName: 'Funmi Alabi', manifesto: 'Secretariat reform: digital minutes, published attendance records, and a union calendar you can actually rely on.', photoUrl: null, order: 1 },
  // Sports
  { id: 'cand-dayo', positionId: 'pos-sport', fullName: 'Dayo Falana', manifesto: 'Inter-hall leagues every semester, better training equipment, and dedicated transport to inter-university games.', photoUrl: null, order: 1 },
  { id: 'cand-sade', positionId: 'pos-sport', fullName: 'Sade Omotoso', manifesto: 'Sport for all — not just the pros. I will expand intramural events and secure the field for evening practice sessions.', photoUrl: null, order: 2 },
  // Social (2 seats)
  { id: 'cand-zainab', positionId: 'pos-social', fullName: 'Zainab Sule', manifesto: 'Freshers\' welcome, end-of-session dinner, and a cultural day that celebrates every region on campus.', photoUrl: null, order: 1 },
  { id: 'cand-ifeanyi', positionId: 'pos-social', fullName: 'Ifeanyi Umeh', manifesto: 'I will revive the campus comedy night and negotiate student discounts with venues around town.', photoUrl: null, order: 2 },
  { id: 'cand-mariam', positionId: 'pos-social', fullName: 'Mariam Danjuma', manifesto: 'Inclusive events with accessible venues and a strict, transparent budget for every outing.', photoUrl: null, order: 3 },
  // PRO
  { id: 'cand-osei', positionId: 'pos-pro', fullName: 'Kwame Osei', manifesto: 'One campus, one voice. Weekly bulletins, a responsive complaints desk, and real engagement metrics for every campaign.', photoUrl: null, order: 1 },
  { id: 'cand-blessing', positionId: 'pos-pro', fullName: 'Blessing Etim', manifesto: 'I will make the union visible: media coverage of student achievements and a redesign of our noticeboards and bulletin feeds.', photoUrl: null, order: 2 },
  // Faculty week — chair (2 seats)
  { id: 'cand-tolulope', positionId: 'pos-chair', fullName: 'Tolulope Aina', manifesto: 'A faculty week that celebrates science: research showcase, industry guest speakers, and the legendary demo exhibitions.', photoUrl: null, order: 1 },
  { id: 'cand-gregory', positionId: 'pos-chair', fullName: 'Gregory Onyema', manifesto: 'Practical focus: lab open days, a coding bootcamp strand, and sponsorships to keep ticket prices low.', photoUrl: null, order: 2 },
  { id: 'cand-rita', positionId: 'pos-chair', fullName: 'Rita Chukwu', manifesto: 'I have coordinated two faculty weeks. I know the budget lines, the vendors, and exactly where the schedule usually slips.', photoUrl: null, order: 3 },
  // Faculty week — publicity
  { id: 'cand-ola', positionId: 'pos-pub', fullName: 'Ola Adegoke', manifesto: 'Posters that people actually read, a content calendar from day one, and coverage on every faculty social channel.', photoUrl: null, order: 1 },
  { id: 'cand-hadiza', positionId: 'pos-pub', fullName: 'Hadiza Lawal', manifesto: 'Design-led publicity with a small team of volunteers and a single visual identity across all materials.', photoUrl: null, order: 2 },
  // PG rep
  { id: 'cand-segun', positionId: 'pos-pgrep', fullName: 'Segun Ajayi', manifesto: 'Postgraduate-specific concerns: thesis timeline advocacy, research funding information sessions, and family-friendly housing lists.', photoUrl: null, order: 1 },
  { id: 'cand-lilian', positionId: 'pos-pgrep', fullName: 'Lilian Okoro', manifesto: 'I will establish a PG mentor-matching scheme and push for dedicated desk space in the library for research students.', photoUrl: null, order: 2 },
  // Sports dept (closed)
  { id: 'cand-emeka', positionId: 'pos-capt', fullName: 'Emeka Obi', manifesto: 'Lead from the front. Daily training discipline and a squad-first mentality.', photoUrl: null, order: 1 },
  { id: 'cand-yusuf', positionId: 'pos-capt', fullName: 'Yusuf Garba', manifesto: 'Tactical awareness and fitness programmes tailored to every position on the field.', photoUrl: null, order: 2 },
  { id: 'cand-seun', positionId: 'pos-asstcapt', fullName: 'Seun Adeyemi', manifesto: 'Supporting role, supporting mindset: logistics, kit management, and morale.', photoUrl: null, order: 1 },
  // SUG 2025/26 (published) — historical candidates
  { id: 'cand-h-adaeze', positionId: 'pos-ppres', fullName: 'Adaeze Okonkwo', manifesto: null, photoUrl: null, order: 1 },
  { id: 'cand-h-ibrahim', positionId: 'pos-ppres', fullName: 'Ibrahim Musa', manifesto: null, photoUrl: null, order: 2 },
  { id: 'cand-h-amara', positionId: 'pos-pvp', fullName: 'Amara Nwosu', manifesto: null, photoUrl: null, order: 1 },
  { id: 'cand-h-tunde', positionId: 'pos-pvp', fullName: 'Tunde Balogun', manifesto: null, photoUrl: null, order: 2 },
  { id: 'cand-h-funmi', positionId: 'pos-pgensec', fullName: 'Funmi Alabi', manifesto: null, photoUrl: null, order: 1 },
  { id: 'cand-h-sade', positionId: 'pos-psocial', fullName: 'Sade Omotoso', manifesto: null, photoUrl: null, order: 1 },
  { id: 'cand-h-bola', positionId: 'pos-psocial', fullName: 'Bola Adeleke', manifesto: null, photoUrl: null, order: 2 },
  { id: 'cand-h-emeka', positionId: 'pos-psocial', fullName: 'Emeka Obi', manifesto: null, photoUrl: null, order: 3 },
  { id: 'cand-h-dayo', positionId: 'pos-ppro', fullName: 'Dayo Falana', manifesto: null, photoUrl: null, order: 1 },
  { id: 'cand-h-ngozi', positionId: 'pos-ppro', fullName: 'Ngozi Eze', manifesto: null, photoUrl: null, order: 2 },
  // PRO by-election (draft)
  { id: 'cand-n-osei', positionId: 'pos-npro', fullName: 'Kwame Osei', manifesto: 'Returning to serve again with a focus on crisis communication and media relations.', photoUrl: null, order: 1 },
]

// -------------------------------------------------------------- voter roll

export const roll: { electionId: string; userId: string; addedAt: string }[] = [
  // SUG 2026/27
  ...['u-chidi', 'u-amara', 'u-tunde', 'u-fatima', 'u-emeka', 'u-ngozi', 'u-seun', 'u-kemi'].map((userId) => ({ electionId: 'elec-sug-2027', userId, addedAt: daysAgo(6) })),
  // Faculty week
  ...['u-chidi', 'u-amara', 'u-tunde', 'u-emeka'].map((userId) => ({ electionId: 'elec-fac-week', userId, addedAt: daysAgo(4) })),
  // PG rep (deliberately excludes the demo voter)
  ...['u-amara', 'u-ngozi'].map((userId) => ({ electionId: 'elec-pg-rep', userId, addedAt: daysAgo(5) })),
  // Sports dept
  ...['u-tunde', 'u-emeka', 'u-seun', 'u-yusuf'].map((userId) => ({ electionId: 'elec-sports-dept', userId, addedAt: daysAgo(12) })),
  // SUG 2025/26 — everyone
  ...users.map((u) => ({ electionId: 'elec-sug-2026', userId: u.id, addedAt: daysAgo(110) })),
  // PRO by-election draft
  { electionId: 'elec-pro-bye', userId: 'u-tunde', addedAt: daysAgo(1) },
]

// ------------------------------------------------------- ballots & results

// Ballots record THAT someone voted + a receipt code — never what they chose.
export const ballots: BallotReceipt[] = [
  { electionId: 'elec-fac-week', userId: 'u-chidi', receiptCode: 'REC-ELEC-8F4A2C1D9B365E07', castAt: daysAgo(0, -20) },
  { electionId: 'elec-fac-week', userId: 'u-amara', receiptCode: 'REC-ELEC-3D7B91A4C208F6E1', castAt: daysAgo(0, -18) },
  { electionId: 'elec-fac-week', userId: 'u-emeka', receiptCode: 'REC-ELEC-B6E048D2FA7913C5', castAt: daysAgo(0, -9) },
  { electionId: 'elec-sports-dept', userId: 'u-tunde', receiptCode: 'REC-ELEC-52C8AB17E04D396F', castAt: daysAgo(2) },
  { electionId: 'elec-sports-dept', userId: 'u-emeka', receiptCode: 'REC-ELEC-91F3D608BCA254E7', castAt: daysAgo(2, -3) },
  { electionId: 'elec-sports-dept', userId: 'u-seun', receiptCode: 'REC-ELEC-C4A719F2D08B61E3', castAt: daysAgo(1) },
]

// Precomputed tallies for CLOSED / PUBLISHED elections (API computes these server-side).
const resultsByElection: Record<string, ElectionResults> = {
  'elec-sports-dept': {
    election: { id: 'elec-sports-dept', title: 'Departmental Sports Committee Election', status: 'CLOSED', publishedAt: null },
    turnout: { registeredVoters: 4, ballotsCast: 3, turnoutPercentage: 75 },
    results: [
      {
        positionId: 'pos-capt', title: 'Team Captain', seats: 1, totalVotes: 3, blankVotes: 0,
        candidates: [
          { id: 'cand-yusuf', fullName: 'Yusuf Garba', photoUrl: null, voteCount: 2, percentage: 66.7 },
          { id: 'cand-emeka', fullName: 'Emeka Obi', photoUrl: null, voteCount: 1, percentage: 33.3 },
        ],
        winners: ['cand-yusuf'], hasTie: false,
      },
      {
        positionId: 'pos-asstcapt', title: 'Assistant Captain', seats: 1, totalVotes: 2, blankVotes: 1,
        candidates: [{ id: 'cand-seun', fullName: 'Seun Adeyemi', photoUrl: null, voteCount: 2, percentage: 100 }],
        winners: ['cand-seun'], hasTie: false,
      },
    ],
  },
  'elec-sug-2026': {
    election: { id: 'elec-sug-2026', title: '2025/2026 SUG Elections — Final Results', status: 'PUBLISHED', publishedAt: daysAgo(90) },
    turnout: { registeredVoters: 12, ballotsCast: 9, turnoutPercentage: 75 },
    results: [
      {
        positionId: 'pos-ppres', title: 'President', seats: 1, totalVotes: 9, blankVotes: 1,
        candidates: [
          { id: 'cand-h-adaeze', fullName: 'Adaeze Okonkwo', photoUrl: null, voteCount: 5, percentage: 55.6 },
          { id: 'cand-h-ibrahim', fullName: 'Ibrahim Musa', photoUrl: null, voteCount: 3, percentage: 33.3 },
        ],
        winners: ['cand-h-adaeze'], hasTie: false,
      },
      {
        positionId: 'pos-pvp', title: 'Vice President', seats: 1, totalVotes: 9, blankVotes: 1,
        candidates: [
          { id: 'cand-h-amara', fullName: 'Amara Nwosu', photoUrl: null, voteCount: 6, percentage: 66.7 },
          { id: 'cand-h-tunde', fullName: 'Tunde Balogun', photoUrl: null, voteCount: 2, percentage: 22.2 },
        ],
        winners: ['cand-h-amara'], hasTie: false,
      },
      {
        positionId: 'pos-pgensec', title: 'General Secretary', seats: 1, totalVotes: 9, blankVotes: 2,
        candidates: [{ id: 'cand-h-funmi', fullName: 'Funmi Alabi', photoUrl: null, voteCount: 7, percentage: 77.8 }],
        winners: ['cand-h-funmi'], hasTie: false,
      },
      {
        // Tie at the seat boundary: Sade and Bola take the 2 seats, Emeka ties Bola at 4.
        positionId: 'pos-psocial', title: 'Social Director', seats: 2, totalVotes: 9, blankVotes: 0,
        candidates: [
          { id: 'cand-h-sade', fullName: 'Sade Omotoso', photoUrl: null, voteCount: 5, percentage: 55.6 },
          { id: 'cand-h-bola', fullName: 'Bola Adeleke', photoUrl: null, voteCount: 4, percentage: 44.4 },
          { id: 'cand-h-emeka', fullName: 'Emeka Obi', photoUrl: null, voteCount: 4, percentage: 44.4 },
        ],
        winners: ['cand-h-sade', 'cand-h-bola'], hasTie: true,
      },
      {
        positionId: 'pos-ppro', title: 'Public Relations Officer', seats: 1, totalVotes: 9, blankVotes: 1,
        candidates: [
          { id: 'cand-h-dayo', fullName: 'Dayo Falana', photoUrl: null, voteCount: 5, percentage: 55.6 },
          { id: 'cand-h-ngozi', fullName: 'Ngozi Eze', photoUrl: null, voteCount: 3, percentage: 33.3 },
        ],
        winners: ['cand-h-dayo'], hasTie: false,
      },
    ],
  },
}

// ------------------------------------------------------------- read paths

function positionsFor(electionId: string): Position[] {
  return positions
    .filter((p) => p.electionId === electionId)
    .sort((a, b) => a.order - b.order)
    .map((p) => ({
      ...p,
      candidates: candidates
        .filter((c) => c.positionId === p.id)
        .sort((a, b) => a.order - b.order),
    }))
}

export function isOnRoll(electionId: string, userId: string): boolean {
  return roll.some((r) => r.electionId === electionId && r.userId === userId)
}

export function findBallot(electionId: string, userId: string): BallotReceipt | undefined {
  return ballots.find((b) => b.electionId === electionId && b.userId === userId)
}

export function listElectionsFor(user: User): Election[] {
  const visible = user.role === 'ADMIN' ? elections : elections.filter((e) => e.status !== 'DRAFT')
  return [...visible].sort((a, b) => b.startsAt.localeCompare(a.startsAt))
}

export function getElection(id: string): Election | undefined {
  return elections.find((e) => e.id === id)
}

/** Mirrors GET /api/v1/elections/:id — returns null when hidden from this user (404). */
export function getDetail(id: string, user: User): ElectionDetail | null {
  const election = getElection(id)
  if (!election) return null
  if (election.status === 'DRAFT' && user.role !== 'ADMIN') return null
  return {
    ...election,
    positions: positionsFor(id),
    viewerStatus: {
      isEligible: isOnRoll(id, user.id),
      hasVoted: findBallot(id, user.id) !== undefined,
    },
  }
}

export function verifyReceipt(receiptCode: string): { ok: true; receipt: BallotReceipt; electionTitle: string } | { ok: false } {
  const normalized = receiptCode.trim().toUpperCase()
  const receipt = ballots.find((b) => b.receiptCode === normalized)
  if (!receipt) return { ok: false }
  const election = getElection(receipt.electionId)
  return { ok: true, receipt, electionTitle: election?.title ?? 'Unknown election' }
}

export function getResults(electionId: string): ElectionResults | null {
  return resultsByElection[electionId] ?? null
}

export function listRoll(electionId: string): RollEntry[] {
  return roll
    .filter((r) => r.electionId === electionId)
    .map((r) => {
      const user = getUserById(r.userId)
      return {
        userId: r.userId,
        fullName: user?.fullName ?? 'Unknown user',
        email: user?.email ?? '',
        matricNo: user?.matricNo ?? null,
        addedAt: r.addedAt,
      }
    })
    .sort((a, b) => a.fullName.localeCompare(b.fullName))
}

// ------------------------------------------------------------ write paths

function makeReceiptCode(electionId: string): string {
  const bytes = [...crypto.getRandomValues(new Uint8Array(8))]
  const hex = bytes.map((b) => b.toString(16).padStart(2, '0')).join('').toUpperCase()
  return `REC-${electionId.slice(0, 4).toUpperCase()}-${hex}`
}

/** Mirrors POST /api/v1/elections/:id/vote. Returns an error string or the receipt. */
export function castBallot(electionId: string, user: User, selections: Selection[]): { receipt: BallotReceipt } | { error: string } {
  const election = getElection(electionId)
  if (!election) return { error: 'Election not found.' }
  if (election.status !== 'OPEN') return { error: 'This election is not open for voting.' }
  const now = Date.now()
  if (now < new Date(election.startsAt).getTime() || now > new Date(election.endsAt).getTime()) {
    return { error: 'Voting is outside the election window.' }
  }
  if (!isOnRoll(electionId, user.id)) return { error: 'You are not on the voter roll for this election.' }
  if (findBallot(electionId, user.id)) return { error: 'You have already cast a ballot in this election.' }

  const electionPositions = positionsFor(electionId)
  for (const sel of selections) {
    const position = electionPositions.find((p) => p.id === sel.positionId)
    if (!position) return { error: 'Invalid position in ballot.' }
    if (sel.candidateId !== null) {
      if (!position.candidates.some((c) => c.id === sel.candidateId)) return { error: 'Invalid candidate in ballot.' }
    }
  }

  const receipt: BallotReceipt = { electionId, userId: user.id, receiptCode: makeReceiptCode(electionId), castAt: new Date().toISOString() }
  ballots.push(receipt)
  return { receipt }
}

// -------------------------------------------------------------- admin ops

const TRANSITIONS: Record<ElectionStatus, ElectionStatus[]> = {
  DRAFT: ['OPEN'],
  OPEN: ['CLOSED'],
  CLOSED: ['PUBLISHED'],
  PUBLISHED: [],
}

export function transitionError(election: Election, next: ElectionStatus): string | null {
  if (!TRANSITIONS[election.status].includes(next)) {
    return `Cannot move an election from ${election.status} to ${next}.`
  }
  if (next === 'OPEN') {
    const ps = positionsFor(election.id)
    if (ps.length === 0) return 'Add at least one position before opening the election.'
    const empty = ps.find((p) => p.candidates.length === 0)
    if (empty) return `Position "${empty.title}" has no candidates — every position needs at least one.`
    if (roll.filter((r) => r.electionId === election.id).length === 0) return 'The voter roll is empty — add voters before opening.'
  }
  return null
}

export function transitionElection(id: string, next: ElectionStatus): string | null {
  const election = getElection(id)
  if (!election) return 'Election not found.'
  const error = transitionError(election, next)
  if (error) return error
  election.status = next
  if (next === 'PUBLISHED') election.publishedAt = new Date().toISOString()
  return null
}

const nextId = (prefix: string) => `${prefix}-${crypto.randomUUID().slice(0, 8)}`

export function createElection(input: { title: string; description: string | null; startsAt: string; endsAt: string }): Election {
  const election: Election = {
    id: nextId('elec'),
    title: input.title,
    description: input.description || null,
    status: 'DRAFT',
    startsAt: input.startsAt,
    endsAt: input.endsAt,
    publishedAt: null,
    createdById: 'u-admin',
  }
  elections.push(election)
  return election
}

export function updateElection(id: string, patch: { title?: string; description?: string | null; startsAt?: string; endsAt?: string }): string | null {
  const election = getElection(id)
  if (!election) return 'Election not found.'
  if (election.status !== 'DRAFT') return 'Only draft elections can be edited.'
  if (patch.title !== undefined) election.title = patch.title
  if (patch.description !== undefined) election.description = patch.description || null
  const startsAt = patch.startsAt ?? election.startsAt
  const endsAt = patch.endsAt ?? election.endsAt
  if (new Date(endsAt).getTime() <= new Date(startsAt).getTime()) return 'End date must be after the start date.'
  election.startsAt = startsAt
  election.endsAt = endsAt
  return null
}

export function deleteElection(id: string): string | null {
  const election = getElection(id)
  if (!election) return 'Election not found.'
  if (election.status !== 'DRAFT') return 'Only draft elections can be deleted.'
  const positionIds = new Set(positions.filter((p) => p.electionId === id).map((p) => p.id))
  const without = <T>(arr: T[], keep: (item: T) => boolean) => {
    for (let i = arr.length - 1; i >= 0; i--) if (!keep(arr[i])) arr.splice(i, 1)
  }
  without(elections, (e) => e.id !== id)
  without(positions, (p) => p.electionId !== id)
  without(candidates, (c) => !positionIds.has(c.positionId))
  without(roll, (r) => r.electionId !== id)
  without(ballots, (b) => b.electionId !== id)
  return null
}

export function addPosition(electionId: string, input: { title: string; seats: number }): string | null {
  const election = getElection(electionId)
  if (!election) return 'Election not found.'
  if (election.status !== 'DRAFT') return 'Positions can only be changed while the election is a draft.'
  if (positions.some((p) => p.electionId === electionId && p.title.toLowerCase() === input.title.trim().toLowerCase())) {
    return 'A position with this title already exists in this election.'
  }
  const maxOrder = Math.max(0, ...positions.filter((p) => p.electionId === electionId).map((p) => p.order))
  positions.push({ id: nextId('pos'), electionId, title: input.title.trim(), seats: input.seats, order: maxOrder + 1, candidates: [] })
  return null
}

export function deletePosition(id: string): string | null {
  const position = positions.find((p) => p.id === id)
  if (!position) return 'Position not found.'
  if (getElection(position.electionId)?.status !== 'DRAFT') return 'Positions can only be changed while the election is a draft.'
  positions.splice(positions.indexOf(position), 1)
  for (let i = candidates.length - 1; i >= 0; i--) if (candidates[i].positionId === id) candidates.splice(i, 1)
  return null
}

export function addCandidate(positionId: string, input: { fullName: string; manifesto: string | null }): string | null {
  const position = positions.find((p) => p.id === positionId)
  if (!position) return 'Position not found.'
  if (getElection(position.electionId)?.status !== 'DRAFT') return 'Candidates can only be changed while the election is a draft.'
  const maxOrder = Math.max(0, ...candidates.filter((c) => c.positionId === positionId).map((c) => c.order))
  candidates.push({ id: nextId('cand'), positionId, fullName: input.fullName.trim(), manifesto: input.manifesto || null, photoUrl: null, order: maxOrder + 1 })
  return null
}

export function deleteCandidate(id: string): string | null {
  const candidate = candidates.find((c) => c.id === id)
  if (!candidate) return 'Candidate not found.'
  const position = positions.find((p) => p.id === candidate.positionId)
  if (!position || getElection(position.electionId)?.status !== 'DRAFT') return 'Candidates can only be changed while the election is a draft.'
  candidates.splice(candidates.indexOf(candidate), 1)
  return null
}

export function addToRoll(electionId: string, userId: string): string | null {
  const election = getElection(electionId)
  if (!election) return 'Election not found.'
  if (election.status !== 'DRAFT') return 'The voter roll is locked once the election opens.'
  if (isOnRoll(electionId, userId)) return 'This voter is already on the roll.'
  if (!getUserById(userId)) return 'User not found.'
  roll.push({ electionId, userId, addedAt: new Date().toISOString() })
  return null
}

export function removeFromRoll(electionId: string, userId: string): string | null {
  const election = getElection(electionId)
  if (!election) return 'Election not found.'
  if (election.status !== 'DRAFT') return 'The voter roll is locked once the election opens.'
  const index = roll.findIndex((r) => r.electionId === electionId && r.userId === userId)
  if (index === -1) return 'Voter is not on the roll.'
  roll.splice(index, 1)
  return null
}

export function adminStats(): { total: number; draft: number; open: number; closed: number; published: number } {
  const count = (s: ElectionStatus) => elections.filter((e) => e.status === s).length
  return { total: elections.length, draft: count('DRAFT'), open: count('OPEN'), closed: count('CLOSED'), published: count('PUBLISHED') }
}
