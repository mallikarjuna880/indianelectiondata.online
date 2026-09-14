import { prisma } from '../db.js';

const publishedElection = { sourceStatus: 'PUBLISHED' as const };
const round = (value: number) => Number(value.toFixed(2));

export type PartyElectionPerformance = {
  electionId: string;
  electionName: string;
  year: number;
  electionType: string;
  seatsContested: number;
  seatsWon: number;
  candidates: number;
  votes: number;
  voteShare: number;
  winRate: number;
  averageVotesPerSeat: number;
  firstPlaceFinishes: number;
  secondPlaceFinishes: number;
  thirdPlaceFinishes: number;
  averageWinningMargin: number;
  totalWinningMargin: number;
  closeLosses: number;
  strongholdWins: number;
};

export type PartyPerformanceMetrics = {
  partyId: string;
  seatsContested: number;
  seatsWon: number;
  seatsLost: number;
  candidates: number;
  votes: number;
  voteShare: number;
  winRate: number;
  averageVotesPerSeat: number;
  firstPlaceFinishes: number;
  secondPlaceFinishes: number;
  thirdPlaceFinishes: number;
  averageWinningMargin: number;
  totalWinningMargin: number;
  closeLosses: number;
  strongholdWins: number;
};

type ResultRow = {
  constituencyVersionId: string;
  candidateId: string;
  votes: number;
  position: number;
  isWinner: boolean;
};

async function getPartyResults(partyId: string, electionId?: string): Promise<ResultRow[]> {
  return prisma.candidateResult.findMany({
    where: { partyId, ...(electionId ? { electionId } : {}), election: publishedElection },
    select: { constituencyVersionId: true, candidateId: true, votes: true, position: true, isWinner: true }
  });
}

async function getWinnerMargins(electionId: string): Promise<Map<string, number>> {
  const results = await prisma.candidateResult.findMany({
    where: { electionId, election: publishedElection },
    select: { constituencyVersionId: true, votes: true, position: true }
  });
  const grouped = new Map<string, number[]>();
  for (const r of results) {
    const values = grouped.get(r.constituencyVersionId) ?? [];
    values.push(r.votes);
    grouped.set(r.constituencyVersionId, values);
  }
  const margins = new Map<string, number>();
  for (const [constituencyVersionId, votes] of grouped) {
    votes.sort((a, b) => b - a);
    if (votes.length >= 2) margins.set(constituencyVersionId, votes[0] - votes[1]);
  }
  return margins;
}

export async function getPartyElectionPerformance(partyId: string): Promise<PartyElectionPerformance[] | null> {
  const party = await prisma.party.findUnique({ where: { id: partyId }, select: { id: true } });
  if (!party) return null;
  const results = await prisma.candidateResult.findMany({
    where: { partyId, election: publishedElection },
    select: { electionId: true, constituencyVersionId: true, candidateId: true, votes: true, position: true, isWinner: true, election: { select: { name: true, year: true, electionType: true } } }
  });
  const totals = await prisma.candidateResult.groupBy({ by: ['electionId'], where: { election: publishedElection }, _sum: { votes: true } });
  const totalMap = new Map(totals.map((t) => [t.electionId, t._sum.votes ?? 0]));
  const groups = new Map<string, PartyElectionPerformance>();
  for (const r of results) {
    const current = groups.get(r.electionId) ?? { electionId: r.electionId, electionName: r.election.name, year: r.election.year, electionType: r.election.electionType, seatsContested: 0, seatsWon: 0, candidates: 0, votes: 0, voteShare: 0, winRate: 0, averageVotesPerSeat: 0, firstPlaceFinishes: 0, secondPlaceFinishes: 0, thirdPlaceFinishes: 0, averageWinningMargin: 0, totalWinningMargin: 0, closeLosses: 0, strongholdWins: 0 };
    current.candidates += 1;
    current.votes += r.votes;
    if (r.isWinner) current.seatsWon += 1;
    if (r.position === 1) current.firstPlaceFinishes += 1;
    if (r.position === 2) current.secondPlaceFinishes += 1;
    if (r.position === 3) current.thirdPlaceFinishes += 1;
    groups.set(r.electionId, current);
  }
  for (const item of groups.values()) {
    const partySeats = results.filter((r) => r.electionId === item.electionId);
    item.seatsContested = new Set(partySeats.map((r) => r.constituencyVersionId)).size;
    const total = totalMap.get(item.electionId) ?? 0;
    item.voteShare = total ? round((item.votes / total) * 100) : 0;
    item.winRate = item.seatsContested ? round((item.seatsWon / item.seatsContested) * 100) : 0;
    item.averageVotesPerSeat = item.seatsContested ? round(item.votes / item.seatsContested) : 0;
    const margins = await getWinnerMargins(item.electionId);
    const winningMargins = partySeats.filter((r) => r.isWinner).map((r) => margins.get(r.constituencyVersionId) ?? 0);
    item.totalWinningMargin = winningMargins.reduce((sum, margin) => sum + margin, 0);
    item.averageWinningMargin = winningMargins.length ? round(item.totalWinningMargin / winningMargins.length) : 0;
    item.closeLosses = partySeats.filter((r) => !r.isWinner && r.position === 2 && (margins.get(r.constituencyVersionId) ?? Infinity) <= 5000).length;
    item.strongholdWins = winningMargins.filter((margin) => margin >= 100000).length;
  }
  return [...groups.values()].sort((a, b) => b.year - a.year);
}

export async function getPartyPerformanceMetrics(partyId: string, electionId?: string): Promise<PartyPerformanceMetrics | null> {
  const party = await prisma.party.findUnique({ where: { id: partyId }, select: { id: true } });
  if (!party) return null;
  const results = await getPartyResults(partyId, electionId);
  if (!results.length) return { partyId, seatsContested: 0, seatsWon: 0, seatsLost: 0, candidates: 0, votes: 0, voteShare: 0, winRate: 0, averageVotesPerSeat: 0, firstPlaceFinishes: 0, secondPlaceFinishes: 0, thirdPlaceFinishes: 0, averageWinningMargin: 0, totalWinningMargin: 0, closeLosses: 0, strongholdWins: 0 };
  const electionIds = electionId ? [electionId] : [...new Set((await prisma.candidateResult.findMany({ where: { partyId, election: publishedElection }, select: { electionId: true } })).map((r) => r.electionId))];
  const margins = new Map<string, number>();
  for (const id of electionIds) for (const [key, value] of await getWinnerMargins(id)) margins.set(key, value);
  const seats = new Set(results.map((r) => r.constituencyVersionId));
  const seatsWon = results.filter((r) => r.isWinner).length;
  const totalVotes = results.reduce((sum, r) => sum + r.votes, 0);
  const totalElectionVotes = (await prisma.candidateResult.groupBy({ by: ['electionId'], where: { electionId: { in: electionIds }, election: publishedElection }, _sum: { votes: true } })).reduce((sum, r) => sum + (r._sum.votes ?? 0), 0);
  const winningMargins = results.filter((r) => r.isWinner).map((r) => margins.get(r.constituencyVersionId) ?? 0);
  const totalWinningMargin = winningMargins.reduce((sum, margin) => sum + margin, 0);
  return { partyId, seatsContested: seats.size, seatsWon, seatsLost: seats.size - seatsWon, candidates: results.length, votes: totalVotes, voteShare: totalElectionVotes ? round((totalVotes / totalElectionVotes) * 100) : 0, winRate: seats.size ? round((seatsWon / seats.size) * 100) : 0, averageVotesPerSeat: seats.size ? round(totalVotes / seats.size) : 0, firstPlaceFinishes: results.filter((r) => r.position === 1).length, secondPlaceFinishes: results.filter((r) => r.position === 2).length, thirdPlaceFinishes: results.filter((r) => r.position === 3).length, averageWinningMargin: winningMargins.length ? round(totalWinningMargin / winningMargins.length) : 0, totalWinningMargin, closeLosses: results.filter((r) => !r.isWinner && r.position === 2 && (margins.get(r.constituencyVersionId) ?? Infinity) <= 5000).length, strongholdWins: winningMargins.filter((margin) => margin >= 100000).length };
}

export async function getPartyStatePerformance(partyId: string, electionId: string): Promise<Array<{ stateId: string; stateName: string; seatsContested: number; seatsWon: number; votes: number; voteShare: number }> | null> {
  const election = await prisma.election.findFirst({ where: { id: electionId, ...publishedElection } });
  const party = await prisma.party.findUnique({ where: { id: partyId }, select: { id: true } });
  if (!election || !party) return null;
  const results = await prisma.candidateResult.findMany({ where: { electionId, partyId, election: publishedElection }, select: { constituencyVersionId: true, votes: true, isWinner: true, constituencyVersion: { select: { constituency: { select: { state: { select: { id: true, name: true } } } } } } } });
  const totalPartyVotes = results.reduce((sum, r) => sum + r.votes, 0);
  const groups = new Map<string, { stateId: string; stateName: string; seatsContested: number; seatsWon: number; votes: number; voteShare: number }>();
  for (const r of results) { const state = r.constituencyVersion.constituency.state; const current = groups.get(state.id) ?? { stateId: state.id, stateName: state.name, seatsContested: 0, seatsWon: 0, votes: 0, voteShare: 0 }; current.votes += r.votes; if (r.isWinner) current.seatsWon += 1; groups.set(state.id, current); }
  const seatSets = new Map<string, Set<string>>();
  for (const r of results) { const stateId = r.constituencyVersion.constituency.state.id; const set = seatSets.get(stateId) ?? new Set<string>(); set.add(r.constituencyVersionId); seatSets.set(stateId, set); }
  for (const item of groups.values()) { item.seatsContested = seatSets.get(item.stateId)?.size ?? 0; item.voteShare = totalPartyVotes ? round((item.votes / totalPartyVotes) * 100) : 0; }
  return [...groups.values()].sort((a, b) => b.seatsWon - a.seatsWon || b.votes - a.votes);
}

export async function getPartyComparison(electionId: string): Promise<Array<{ partyId: string | null; partyName: string; abbreviation: string | null; seatsWon: number; candidates: number; votes: number; voteShare: number; winRate: number }> | null> {
  const election = await prisma.election.findFirst({ where: { id: electionId, ...publishedElection } });
  if (!election) return null;
  const results = await prisma.candidateResult.findMany({ where: { electionId, election: publishedElection }, select: { partyId: true, candidateId: true, votes: true, isWinner: true, party: { select: { name: true, abbreviation: true } } } });
  const totalVotes = results.reduce((sum, r) => sum + r.votes, 0);
  const groups = new Map<string, { partyId: string | null; partyName: string; abbreviation: string | null; seatsWon: number; candidates: number; votes: number; voteShare: number; winRate: number }>();
  for (const r of results) { const key = r.partyId ?? 'UNAFFILIATED'; const current = groups.get(key) ?? { partyId: r.partyId, partyName: r.party?.name ?? 'Unaffiliated', abbreviation: r.party?.abbreviation ?? null, seatsWon: 0, candidates: 0, votes: 0, voteShare: 0, winRate: 0 }; current.candidates += 1; current.votes += r.votes; if (r.isWinner) current.seatsWon += 1; groups.set(key, current); }
  return [...groups.values()].map((p) => ({ ...p, voteShare: totalVotes ? round((p.votes / totalVotes) * 100) : 0, winRate: p.candidates ? round((p.seatsWon / p.candidates) * 100) : 0 })).sort((a, b) => b.seatsWon - a.seatsWon || b.votes - a.votes);
}
