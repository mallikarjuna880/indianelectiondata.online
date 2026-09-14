import type { FastifyInstance } from 'fastify';
import { getPartyComparison, getPartyElectionPerformance, getPartyPerformanceMetrics, getPartyStatePerformance } from './party-analytics.js';

export async function registerPartyAnalyticsApi(app: FastifyInstance) {
  app.get('/api/v1/analytics/parties/:id/performance', async (request, reply) => {
    const { id } = request.params as { id: string };
    const data = await getPartyElectionPerformance(id);
    if (!data) return reply.code(404).send({ error: 'PARTY_NOT_FOUND' });
    return { data };
  });

  app.get('/api/v1/analytics/parties/:id/metrics', async (request, reply) => {
    const { id } = request.params as { id: string };
    const { electionId } = request.query as { electionId?: string };
    const data = await getPartyPerformanceMetrics(id, electionId);
    if (!data) return reply.code(404).send({ error: 'PARTY_NOT_FOUND' });
    return { data };
  });

  app.get('/api/v1/analytics/parties/:id/elections/:electionId/states', async (request, reply) => {
    const { id, electionId } = request.params as { id: string; electionId: string };
    const data = await getPartyStatePerformance(id, electionId);
    if (!data) return reply.code(404).send({ error: 'PARTY_OR_ELECTION_NOT_FOUND' });
    return { data };
  });

  app.get('/api/v1/analytics/elections/:id/party-comparison', async (request, reply) => {
    const { id } = request.params as { id: string };
    const data = await getPartyComparison(id);
    if (!data) return reply.code(404).send({ error: 'ELECTION_NOT_FOUND' });
    return { data };
  });
}
