import type { FastifyInstance } from 'fastify';
import { getPartyComparison, getPartyElectionPerformance, getPartyPerformanceMetrics, getPartyStatePerformance } from './party-analytics.js';

type RankingMetric = 'seats' | 'votes' | 'voteShare' | 'winRate';

function rankParties(data: Awaited<ReturnType<typeof getPartyComparison>>, metric: RankingMetric) {
  if (!data) return null;
  const sorted = [...data].sort((a, b) => {
    const av = metric === 'seats' ? a.seatsWon : metric === 'votes' ? a.votes : metric === 'voteShare' ? a.voteShare : a.winRate;
    const bv = metric === 'seats' ? b.seatsWon : metric === 'votes' ? b.votes : metric === 'voteShare' ? b.voteShare : b.winRate;
    return bv - av || b.seatsWon - a.seatsWon || b.votes - a.votes;
  });
  let previousValue: number | undefined;
  let previousRank = 0;
  return sorted.map((party, index) => {
    const value = metric === 'seats' ? party.seatsWon : metric === 'votes' ? party.votes : metric === 'voteShare' ? party.voteShare : party.winRate;
    const rank = value === previousValue ? previousRank : index + 1;
    previousValue = value; previousRank = rank;
    return { rank, partyId: party.partyId, partyName: party.partyName, abbreviation: party.abbreviation, seatsWon: party.seatsWon, candidates: party.candidates, votes: party.votes, voteShare: party.voteShare, winRate: party.winRate, metric, metricValue: value };
  });
}

export async function registerPartyAnalyticsApi(app: FastifyInstance) {
  app.get('/api/v1/analytics/parties/:id/performance', async (request, reply) => {
    const { id } = request.params as { id: string }; const data = await getPartyElectionPerformance(id);
    if (!data) return reply.code(404).send({ error: 'PARTY_NOT_FOUND' }); return { data };
  });

  app.get('/api/v1/analytics/parties/:id/metrics', async (request, reply) => {
    const { id } = request.params as { id: string }; const { electionId } = request.query as { electionId?: string }; const data = await getPartyPerformanceMetrics(id, electionId);
    if (!data) return reply.code(404).send({ error: 'PARTY_NOT_FOUND' }); return { data };
  });

  app.get('/api/v1/analytics/parties/:id/elections/:electionId/states', async (request, reply) => {
    const { id, electionId } = request.params as { id: string; electionId: string }; const data = await getPartyStatePerformance(id, electionId);
    if (!data) return reply.code(404).send({ error: 'PARTY_OR_ELECTION_NOT_FOUND' }); return { data };
  });

  app.get('/api/v1/analytics/elections/:id/party-comparison', async (request, reply) => {
    const { id } = request.params as { id: string }; const data = await getPartyComparison(id);
    if (!data) return reply.code(404).send({ error: 'ELECTION_NOT_FOUND' }); return { data };
  });

  app.get('/api/v1/analytics/elections/:id/party-rankings', async (request, reply) => {
    const { id } = request.params as { id: string };
    const { metric = 'seats' } = request.query as { metric?: string };
    if (!['seats', 'votes', 'voteShare', 'winRate'].includes(metric)) return reply.code(400).send({ error: 'INVALID_RANKING_METRIC', allowed: ['seats', 'votes', 'voteShare', 'winRate'] });
    const data = rankParties(await getPartyComparison(id), metric as RankingMetric);
    if (!data) return reply.code(404).send({ error: 'ELECTION_NOT_FOUND' });
    return { metric, data };
  });

  app.get('/api/v1/analytics/elections/:id/party-compare', async (request, reply) => {
    const { id } = request.params as { id: string };
    const { partyIds = '', compareElectionId } = request.query as { partyIds?: string; compareElectionId?: string };
    const selected = partyIds.split(',').map((v) => v.trim()).filter(Boolean);
    if (selected.length > 10) return reply.code(400).send({ error: 'TOO_MANY_PARTIES', max: 10 });
    const current = await getPartyComparison(id);
    if (!current) return reply.code(404).send({ error: 'ELECTION_NOT_FOUND' });
    const currentRanked = rankParties(current, 'seats') ?? [];
    const currentRows = selected.length ? currentRanked.filter((p) => p.partyId && selected.includes(p.partyId)) : currentRanked;
    if (!compareElectionId) return { electionId: id, data: currentRows };
    const previous = await getPartyComparison(compareElectionId);
    if (!previous) return reply.code(404).send({ error: 'COMPARE_ELECTION_NOT_FOUND' });
    const previousRanked = rankParties(previous, 'seats') ?? [];
    const previousMap = new Map(previousRanked.map((p) => [p.partyId, p]));
    return { electionId: id, compareElectionId, data: currentRows.map((p) => { const old = previousMap.get(p.partyId); return { ...p, seatChange: old ? p.seatsWon - old.seatsWon : null, voteShareChange: old ? Number((p.voteShare - old.voteShare).toFixed(2)) : null, rankChange: old ? old.rank - p.rank : null, performanceChange: old ? Number((p.winRate - old.winRate).toFixed(2)) : null }; }) };
  });
}
