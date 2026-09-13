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
};

export async function getPartyElectionPerformance(partyId: string): Promise<PartyElectionPerformance[] | null> {
  const party = await prisma.party.findUnique({ where: { id: partyId }, select: { id: true } });
  if (!party) return null;
  const results = await prisma.candidateResult.findMany({
    where: { partyId, election: publishedElection },
    select: { electionId: true, constituencyVersionId: true, candidateId: true, votes: true, isWinner: true, election: { select: { name: true, year: true, electionType: true } } }
  });
  const totals = await prisma.candidateResult.groupBy({ by: ['electionId'], where: { election: publishedElection }, _sum: { votes: true } });
  const totalMap = new Map(totals.map((t) => [t.electionId, t._sum.votes ?? 0]));
  const groups = new Map<string, PartyElectionPerformance>();
  for (const r of results) {
    const current = groups.get(r.electionId) ?? { electionId: r.electionId, electionName: r.election.name, year: r.election.year, electionType: r.election.electionType, seatsContested: 0, seatsWon: 0, candidates: 0, votes: 0, voteShare: 0, winRate: 0 };
    current.candidates += 1;
    current.votes += r.votes;
    if (r.isWinner) current.seatsWon += 1;
    groups.set(r.electionId, current);
  }
  for (const item of groups.values()) {
    item.seatsContested = new Set(results.filter((r) => r.electionId === item.electionId).map((r) => r.constituencyVersionId)).size;
    const total = totalMap.get(item.electionId) ?? 0;
    item.voteShare = total ? round((item.votes / total) * 100) : 0;
    item.winRate = item.candidates ? round((item.seatsWon / item.candidates) * 100) : 0;
  }
  return [...groups.values()].sort((a, b) => b.year - a.year);
}

export async function getPartyStatePerformance(partyId: string, electionId: string): Promise<Array<{ stateId: string; stateName: string; seatsContested: number; seatsWon: number; votes: number; voteShare: number }> | null> {
  const election = await prisma.election.findFirst({ where: { id: electionId, ...publishedElection } });
  const party = await prisma.party.findUnique({ where: { id: partyId }, select: { id: true } });
  if (!election || !party) return null;
  const results = await prisma.candidateResult.findMany({ where: { electionId, partyId, election: publishedElection }, select: { constituencyVersionId: true, votes: true, isWinner: true, constituencyVersion: { select: { constituency: { select: { state: { select: { id: true, name: true } } } } } } } });
  const totalPartyVotes = results.reduce((sum, r) => sum + r.votes, 0);
  const groups = new Map<string, { stateId: string; stateName: string; seatsContested: number; seatsWon: number; votes: number; voteShare: number }>();
  for (const r of results) {
    const state = r.constituencyVersion.constituency.state;
    const current = groups.get(state.id) ?? { stateId: state.id, stateName: state.name, seatsContested: 0, seatsWon: 0, votes: 0, voteShare: 0 };
    current.votes += r.votes;
    if (r.isWinner) current.seatsWon += 1;
    groups.set(state.id, current);
  }
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
