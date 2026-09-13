import type { FastifyInstance } from 'fastify';
import { prisma } from './db.js';

const DEFAULT_PAGE_SIZE = 50;
const MAX_PAGE_SIZE = 100;

function pagination(request: { query: unknown }) {
  const query = (request.query || {}) as { page?: string; limit?: string };
  const page = Math.max(1, Number.parseInt(query.page || '1', 10) || 1);
  const limit = Math.min(MAX_PAGE_SIZE, Math.max(1, Number.parseInt(query.limit || String(DEFAULT_PAGE_SIZE), 10) || DEFAULT_PAGE_SIZE));
  return { page, limit, skip: (page - 1) * limit };
}

function pageResponse<T>(data: T[], total: number, page: number, limit: number) {
  return { data, pagination: { page, limit, total, totalPages: Math.ceil(total / limit) } };
}

const publishedElection = { sourceStatus: 'PUBLISHED' as const };

export async function registerPublicApi(app: FastifyInstance) {
  app.get('/api/v1/elections', async (request) => {
    const { page, limit, skip } = pagination(request);
    const query = (request.query || {}) as { year?: string };
    const year = query.year ? Number.parseInt(query.year, 10) : undefined;
    const where = { ...publishedElection, ...(Number.isFinite(year) ? { year } : {}) };
    const [data, total] = await prisma.$transaction([
      prisma.election.findMany({ where, orderBy: [{ year: 'desc' }, { name: 'asc' }], skip, take: limit, select: { id: true, name: true, electionType: true, year: true, electionDate: true, description: true, sourceStatus: true } }),
      prisma.election.count({ where })
    ]);
    return pageResponse(data, total, page, limit);
  });

  app.get('/api/v1/elections/:id', async (request, reply) => {
    const { id } = request.params as { id: string };
    const data = await prisma.election.findFirst({ where: { id, ...publishedElection }, select: { id: true, name: true, electionType: true, year: true, electionDate: true, description: true, sourceStatus: true } });
    if (!data) return reply.code(404).send({ error: 'ELECTION_NOT_FOUND' });
    return { data };
  });

  app.get('/api/v1/states', async (request) => {
    const { page, limit, skip } = pagination(request);
    const data = await prisma.state.findMany({ where: { constituencies: { some: { versions: { some: { election: publishedElection } } } } }, orderBy: { name: 'asc' }, skip, take: limit, select: { id: true, name: true, abbreviation: true, stateCode: true } });
    const total = await prisma.state.count({ where: { constituencies: { some: { versions: { some: { election: publishedElection } } } } } });
    return pageResponse(data, total, page, limit);
  });

  app.get('/api/v1/states/:id', async (request, reply) => {
    const { id } = request.params as { id: string };
    const data = await prisma.state.findFirst({ where: { id, constituencies: { some: { versions: { some: { election: publishedElection } } } } }, select: { id: true, name: true, abbreviation: true, stateCode: true } });
    if (!data) return reply.code(404).send({ error: 'STATE_NOT_FOUND' });
    return { data };
  });

  app.get('/api/v1/constituencies', async (request) => {
    const { page, limit, skip } = pagination(request);
    const query = (request.query || {}) as { stateId?: string; electionId?: string };
    const where = {
      ...(query.stateId ? { stateId: query.stateId } : {}),
      versions: { some: { ...(query.electionId ? { electionId: query.electionId } : {}), election: publishedElection } }
    };
    const [data, total] = await prisma.$transaction([
      prisma.constituency.findMany({ where, orderBy: { name: 'asc' }, skip, take: limit, select: { id: true, name: true, latitude: true, longitude: true, state: { select: { id: true, name: true, abbreviation: true } } } }),
      prisma.constituency.count({ where })
    ]);
    return pageResponse(data, total, page, limit);
  });

  app.get('/api/v1/constituencies/:id', async (request, reply) => {
    const { id } = request.params as { id: string };
    const data = await prisma.constituency.findFirst({ where: { id, versions: { some: { election: publishedElection } } }, select: { id: true, name: true, latitude: true, longitude: true, state: { select: { id: true, name: true, abbreviation: true, stateCode: true } } } });
    if (!data) return reply.code(404).send({ error: 'CONSTITUENCY_NOT_FOUND' });
    return { data };
  });

  app.get('/api/v1/constituency-versions', async (request) => {
    const { page, limit, skip } = pagination(request);
    const query = (request.query || {}) as { electionId?: string; constituencyId?: string };
    const where = { ...(query.electionId ? { electionId: query.electionId } : {}), ...(query.constituencyId ? { constituencyId: query.constituencyId } : {}), election: publishedElection };
    const [data, total] = await prisma.$transaction([
      prisma.constituencyVersion.findMany({ where, orderBy: { name: 'asc' }, skip, take: limit, select: { id: true, name: true, constituencyNumber: true, reservedCategory: true, delimitationVersion: true, constituency: { select: { id: true, name: true, state: { select: { id: true, name: true } } } }, election: { select: { id: true, name: true, electionType: true, year: true } } } }),
      prisma.constituencyVersion.count({ where })
    ]);
    return pageResponse(data, total, page, limit);
  });

  app.get('/api/v1/parties', async (request) => {
    const { page, limit, skip } = pagination(request);
    const data = await prisma.party.findMany({ where: { results: { some: { election: publishedElection } } }, orderBy: { name: 'asc' }, skip, take: limit, select: { id: true, name: true, abbreviation: true, symbolUrl: true, foundedYear: true, dissolvedYear: true } });
    const total = await prisma.party.count({ where: { results: { some: { election: publishedElection } } } });
    return pageResponse(data, total, page, limit);
  });

  app.get('/api/v1/parties/:id', async (request, reply) => {
    const { id } = request.params as { id: string };
    const data = await prisma.party.findFirst({ where: { id, results: { some: { election: publishedElection } } }, select: { id: true, name: true, abbreviation: true, symbolUrl: true, foundedYear: true, dissolvedYear: true } });
    if (!data) return reply.code(404).send({ error: 'PARTY_NOT_FOUND' });
    return { data };
  });

  const resultWhere = (query: { electionId?: string; constituencyVersionId?: string; candidateId?: string; partyId?: string }) => ({
    ...(query.electionId ? { electionId: query.electionId } : {}),
    ...(query.constituencyVersionId ? { constituencyVersionId: query.constituencyVersionId } : {}),
    ...(query.candidateId ? { candidateId: query.candidateId } : {}),
    ...(query.partyId ? { partyId: query.partyId } : {}),
    election: publishedElection
  });

  const resultSelect = {
    id: true, votes: true, voteShare: true, position: true, isWinner: true,
    election: { select: { id: true, name: true, year: true, electionType: true } },
    constituencyVersion: { select: { id: true, name: true, constituencyNumber: true, constituency: { select: { id: true, name: true, state: { select: { id: true, name: true } } } } } },
    candidate: { select: { id: true, name: true, gender: true, photoUrl: true } },
    party: { select: { id: true, name: true, abbreviation: true, symbolUrl: true } }
  } as const;

  app.get('/api/v1/candidates', async (request) => {
    const { page, limit, skip } = pagination(request);
    const query = (request.query || {}) as { electionId?: string; partyId?: string };
    const where = { results: { some: { ...(query.electionId ? { electionId: query.electionId } : {}), ...(query.partyId ? { partyId: query.partyId } : {}), election: publishedElection } } };
    const [data, total] = await prisma.$transaction([
      prisma.candidate.findMany({ where, orderBy: { name: 'asc' }, skip, take: limit, select: { id: true, name: true, gender: true, dateOfBirth: true, biography: true, photoUrl: true } }),
      prisma.candidate.count({ where })
    ]);
    return pageResponse(data, total, page, limit);
  });

  app.get('/api/v1/candidates/:id', async (request, reply) => {
    const { id } = request.params as { id: string };
    const data = await prisma.candidate.findFirst({ where: { id, results: { some: { election: publishedElection } } }, select: { id: true, name: true, gender: true, dateOfBirth: true, biography: true, photoUrl: true } });
    if (!data) return reply.code(404).send({ error: 'CANDIDATE_NOT_FOUND' });
    return { data };
  });

  app.get('/api/v1/results', async (request) => {
    const { page, limit, skip } = pagination(request);
    const query = (request.query || {}) as { electionId?: string; constituencyVersionId?: string; candidateId?: string; partyId?: string };
    const where = resultWhere(query);
    const [data, total] = await prisma.$transaction([
      prisma.candidateResult.findMany({ where, orderBy: [{ election: { year: 'desc' } }, { position: 'asc' }], skip, take: limit, select: resultSelect }),
      prisma.candidateResult.count({ where })
    ]);
    return pageResponse(data, total, page, limit);
  });

  app.get('/api/v1/results/:id', async (request, reply) => {
    const { id } = request.params as { id: string };
    const data = await prisma.candidateResult.findFirst({ where: { id, election: publishedElection }, select: resultSelect });
    if (!data) return reply.code(404).send({ error: 'RESULT_NOT_FOUND' });
    return { data };
  });

  app.get('/api/v1/winners', async (request) => {
    const { page, limit, skip } = pagination(request);
    const query = (request.query || {}) as { electionId?: string; constituencyVersionId?: string; partyId?: string };
    const where = { ...resultWhere(query), isWinner: true };
    const [data, total] = await prisma.$transaction([
      prisma.candidateResult.findMany({ where, orderBy: [{ election: { year: 'desc' } }, { position: 'asc' }], skip, take: limit, select: resultSelect }),
      prisma.candidateResult.count({ where })
    ]);
    return pageResponse(data, total, page, limit);
  });

  app.get('/api/v1/vote-shares', async (request) => {
    const { page, limit, skip } = pagination(request);
    const query = (request.query || {}) as { electionId?: string; partyId?: string; constituencyVersionId?: string };
    const where = resultWhere(query);
    const [data, total] = await prisma.$transaction([
      prisma.candidateResult.findMany({ where, orderBy: [{ election: { year: 'desc' } }, { voteShare: 'desc' }], skip, take: limit, select: resultSelect }),
      prisma.candidateResult.count({ where })
    ]);
    return pageResponse(data, total, page, limit);
  });
}
