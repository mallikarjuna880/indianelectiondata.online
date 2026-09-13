import { prisma } from '../db.js';

const publishedElection = { sourceStatus: 'PUBLISHED' as const };

export type ElectionSummary = {
  electionId: string;
  seatsContested: number;
  seatsWithResults: number;
  candidates: number;
  parties: number;
  totalVotes: number;
  winningResults: number;
  turnout: number | null;
  notaVotes: number;
};

export async function getElectionSummary(electionId: string): Promise<ElectionSummary | null> {
  const election = await prisma.election.findFirst({ where: { id: electionId, ...publishedElection } });
  if (!election) return null;

  const [results, statistics] = await prisma.$transaction([
    prisma.candidateResult.findMany({ where: { electionId, election: publishedElection }, select: { constituencyVersionId: true, candidateId: true, partyId: true, votes: true, isWinner: true } }),
    prisma.constituencyStatistic.findMany({ where: { electionId, election: publishedElection }, select: { electors: true, votesPolled: true, turnoutPercentage: true, notaVotes: true } })
  ]);

  const seats = new Set(results.map((r) => r.constituencyVersionId));
  const candidates = new Set(results.map((r) => r.candidateId));
  const parties = new Set(results.map((r) => r.partyId).filter(Boolean));
  const totalVotes = results.reduce((sum, r) => sum + r.votes, 0);
  const electors = statistics.reduce((sum, s) => sum + (s.electors ?? 0), 0);
  const votesPolled = statistics.reduce((sum, s) => sum + (s.votesPolled ?? 0), 0);
  const turnoutValues = statistics.map((s) => s.turnoutPercentage == null ? null : Number(s.turnoutPercentage)).filter((v): v is number => v !== null);
  const turnout = electors > 0 ? (votesPolled / electors) * 100 : (turnoutValues.length ? turnoutValues.reduce((a, b) => a + b, 0) / turnoutValues.length : null);

  return {
    electionId,
    seatsContested: seats.size,
    seatsWithResults: new Set(results.filter((r) => r.isWinner).map((r) => r.constituencyVersionId)).size,
    candidates: candidates.size,
    parties: parties.size,
    totalVotes,
    winningResults: results.filter((r) => r.isWinner).length,
    turnout: turnout == null ? null : Number(turnout.toFixed(2)),
    notaVotes: statistics.reduce((sum, s) => sum + (s.notaVotes ?? 0), 0)
  };
}

export type PartyPerformance = {
  partyId: string | null;
  partyName: string;
  abbreviation: string | null;
  seatsWon: number;
  candidates: number;
  votes: number;
  voteShare: number;
  winRate: number;
};

export async function getElectionPartyPerformance(electionId: string): Promise<PartyPerformance[] | null> {
  const election = await prisma.election.findFirst({ where: { id: electionId, ...publishedElection } });
  if (!election) return null;
  const results = await prisma.candidateResult.findMany({
    where: { electionId, election: publishedElection },
    select: { partyId: true, votes: true, isWinner: true, candidateId: true, party: { select: { name: true, abbreviation: true } } }
  });
  const totalVotes = results.reduce((sum, r) => sum + r.votes, 0);
  const groups = new Map<string, PartyPerformance>();
  for (const result of results) {
    const key = result.partyId ?? 'UNAFFILIATED';
    const current = groups.get(key) ?? { partyId: result.partyId, partyName: result.party?.name ?? 'Unaffiliated', abbreviation: result.party?.abbreviation ?? null, seatsWon: 0, candidates: 0, votes: 0, voteShare: 0, winRate: 0 };
    current.candidates += 1;
    current.votes += result.votes;
    if (result.isWinner) current.seatsWon += 1;
    groups.set(key, current);
  }
  return [...groups.values()].map((item) => ({ ...item, voteShare: totalVotes ? Number(((item.votes / totalVotes) * 100).toFixed(2)) : 0, winRate: item.candidates ? Number(((item.seatsWon / item.candidates) * 100).toFixed(2)) : 0 })).sort((a, b) => b.votes - a.votes);
}

export type StatePerformance = {
  stateId: string;
  stateName: string;
  seatsWon: number;
  seatsWithResults: number;
  votes: number;
  voteShare: number;
};

export async function getElectionStatePerformance(electionId: string): Promise<StatePerformance[] | null> {
  const election = await prisma.election.findFirst({ where: { id: electionId, ...publishedElection } });
  if (!election) return null;
  const results = await prisma.candidateResult.findMany({
    where: { electionId, election: publishedElection },
    select: { constituencyVersionId: true, votes: true, isWinner: true, constituencyVersion: { select: { constituency: { select: { state: { select: { id: true, name: true } } } } } } }
  });
  const totals = new Map<string, StatePerformance>();
  for (const result of results) {
    const state = result.constituencyVersion.constituency.state;
    const current = totals.get(state.id) ?? { stateId: state.id, stateName: state.name, seatsWon: 0, seatsWithResults: 0, votes: 0, voteShare: 0 };
    current.votes += result.votes;
    if (result.isWinner) current.seatsWon += 1;
    totals.set(state.id, current);
  }
  for (const item of totals.values()) {
    item.seatsWithResults = new Set(results.filter((r) => r.constituencyVersion.constituency.state.id === item.stateId).map((r) => r.constituencyVersionId)).size;
    const stateTotal = item.votes;
    item.voteShare = stateTotal ? 100 : 0;
  }
  return [...totals.values()].sort((a, b) => b.seatsWon - a.seatsWon || b.votes - a.votes);
}

export type ConstituencyMargin = {
  constituencyVersionId: string;
  constituencyName: string;
  constituencyId: string;
  stateId: string;
  stateName: string;
  winner: { candidateId: string; candidateName: string; partyId: string | null; partyName: string | null; votes: number; voteShare: number | null } | null;
  runnerUp: { candidateId: string; candidateName: string; partyId: string | null; partyName: string | null; votes: number; voteShare: number | null } | null;
  margin: number | null;
};

export async function getElectionMargins(electionId: string): Promise<ConstituencyMargin[] | null> {
  const election = await prisma.election.findFirst({ where: { id: electionId, ...publishedElection } });
  if (!election) return null;
  const results = await prisma.candidateResult.findMany({
    where: { electionId, election: publishedElection },
    orderBy: [{ constituencyVersionId: 'asc' }, { votes: 'desc' }],
    select: { constituencyVersionId: true, candidateId: true, votes: true, voteShare: true, isWinner: true, candidate: { select: { name: true } }, party: { select: { id: true, name: true } }, constituencyVersion: { select: { name: true, constituency: { select: { id: true, state: { select: { id: true, name: true } } } } } } }
  });
  const grouped = new Map<string, typeof results>();
  for (const result of results) grouped.set(result.constituencyVersionId, [...(grouped.get(result.constituencyVersionId) ?? []), result]);
  return [...grouped.values()].map((items) => {
    const winner = items.find((r) => r.isWinner) ?? items[0];
    const runnerUp = items.find((r) => r.candidateId !== winner?.candidateId) ?? null;
    return {
      constituencyVersionId: winner.constituencyVersionId,
      constituencyName: winner.constituencyVersion.name,
      constituencyId: winner.constituencyVersion.constituency.id,
      stateId: winner.constituencyVersion.constituency.state.id,
      stateName: winner.constituencyVersion.constituency.state.name,
      winner: winner ? { candidateId: winner.candidateId, candidateName: winner.candidate.name, partyId: winner.party?.id ?? null, partyName: winner.party?.name ?? null, votes: winner.votes, voteShare: winner.voteShare == null ? null : Number(winner.voteShare) } : null,
      runnerUp: runnerUp ? { candidateId: runnerUp.candidateId, candidateName: runnerUp.candidate.name, partyId: runnerUp.party?.id ?? null, partyName: runnerUp.party?.name ?? null, votes: runnerUp.votes, voteShare: runnerUp.voteShare == null ? null : Number(runnerUp.voteShare) } : null,
      margin: runnerUp ? winner.votes - runnerUp.votes : null
    };
  }).sort((a, b) => (b.margin ?? -1) - (a.margin ?? -1));
}

export async function getConstituencyAnalytics(constituencyId: string, electionId?: string) {
  const version = await prisma.constituencyVersion.findFirst({
    where: { constituencyId, ...(electionId ? { electionId } : {}), election: publishedElection },
    orderBy: { election: { year: 'desc' } },
    select: { id: true, name: true, constituencyNumber: true, election: { select: { id: true, name: true, year: true, electionType: true } }, constituency: { select: { id: true, name: true, state: { select: { id: true, name: true, abbreviation: true } } } }, results: { orderBy: { votes: 'desc' }, select: { candidateId: true, votes: true, voteShare: true, position: true, isWinner: true, candidate: { select: { name: true } }, party: { select: { id: true, name: true, abbreviation: true } } } }, statistics: { select: { electors: true, votesPolled: true, validVotes: true, notaVotes: true, turnoutPercentage: true } } }
  });
  if (!version) return null;
  const winner = version.results.find((r) => r.isWinner) ?? version.results[0];
  const runnerUp = version.results.find((r) => r.candidateId !== winner?.candidateId);
  return {
    constituency: version.constituency,
    version: { id: version.id, name: version.name, constituencyNumber: version.constituencyNumber },
    election: version.election,
    winner: winner ? { ...winner, voteShare: winner.voteShare == null ? null : Number(winner.voteShare) } : null,
    runnerUp: runnerUp ? { ...runnerUp, voteShare: runnerUp.voteShare == null ? null : Number(runnerUp.voteShare) } : null,
    margin: winner && runnerUp ? winner.votes - runnerUp.votes : null,
    statistics: version.statistics
  };
}
