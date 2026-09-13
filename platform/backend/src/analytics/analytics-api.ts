import type { FastifyInstance } from 'fastify';
import { getConstituencyAnalytics, getElectionMargins, getElectionPartyPerformance, getElectionStatePerformance, getElectionSummary, getElectionTurnout } from './election-analytics.js';

export async function registerAnalyticsApi(app: FastifyInstance) {
  app.get('/api/v1/analytics/elections/:id/summary', async (request, reply) => {
    const { id } = request.params as { id: string };
    const data = await getElectionSummary(id);
    if (!data) return reply.code(404).send({ error: 'ELECTION_NOT_FOUND' });
    return { data };
  });

  app.get('/api/v1/analytics/elections/:id/parties', async (request, reply) => {
    const { id } = request.params as { id: string };
    const data = await getElectionPartyPerformance(id);
    if (!data) return reply.code(404).send({ error: 'ELECTION_NOT_FOUND' });
    return { data };
  });

  app.get('/api/v1/analytics/elections/:id/states', async (request, reply) => {
    const { id } = request.params as { id: string };
    const data = await getElectionStatePerformance(id);
    if (!data) return reply.code(404).send({ error: 'ELECTION_NOT_FOUND' });
    return { data };
  });

  app.get('/api/v1/analytics/elections/:id/margins', async (request, reply) => {
    const { id } = request.params as { id: string };
    const data = await getElectionMargins(id);
    if (!data) return reply.code(404).send({ error: 'ELECTION_NOT_FOUND' });
    return { data };
  });

  app.get('/api/v1/analytics/elections/:id/turnout', async (request, reply) => {
    const { id } = request.params as { id: string };
    const data = await getElectionTurnout(id);
    if (!data) return reply.code(404).send({ error: 'ELECTION_NOT_FOUND' });
    return { data };
  });

  app.get('/api/v1/analytics/constituencies/:id', async (request, reply) => {
    const { id } = request.params as { id: string };
    const { electionId } = (request.query || {}) as { electionId?: string };
    const data = await getConstituencyAnalytics(id, electionId);
    if (!data) return reply.code(404).send({ error: 'CONSTITUENCY_ANALYTICS_NOT_FOUND' });
    return { data };
  });
}
