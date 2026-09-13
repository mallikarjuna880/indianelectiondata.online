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

function optionalInt(value: unknown): number | undefined {
  if (value === undefined || value === '') return undefined;
  const parsed = Number.parseInt(String(value), 10);
  return Number.isFinite(parsed) ? parsed : undefined;
}

export async function registerPublicApi(app: FastifyInstance) {
  app.get('/api/v1/elections', async (request) => {
    const { page, limit, skip } = pagination(request);
    const query = (request.query || {}) as { year?: string; type?: string };
    const where = {
      sourceStatus: 'PUBLISHED' as const,
      ...(optionalInt(query.year) !== undefined ? { year: optionalInt(query.year) } : {}),
      ...(query.type ? { electionType: query.type as any } : {})
    };
    const [data, total] = await prisma.$transaction([
      prisma.election.findMany({ where, orderBy: [{ year: 'desc' }, { name: 'asc' }], skip, take: limit, select: { id: true, name: true, electionType: true, year: true, electionDate: true, description: true, sourceStatus: true } }),
      prisma.election.count({ where })
    ]);
    return pageResponse(data, total, page, limit);
  });

  app.get('/api/v1/elections/:id', async (request, reply) => {
    const { id } = request.params as { id: string };
    const election = await prisma.election.findFirst({ where: { id, sourceStatus: 'PUBLISHED' }, select: { id: true, name: true, electionType: true, year: true, electionDate: true, description: true, sourceStatus: true } });
    if (!election) return reply.code(404).send({ error: 'ELECTION_NOT_FOUND' });
    return { data: election };
  });

  app.get('/api/v1/states', async (request) => {
    const { page, limit, skip } = pagination(request);
    const query = (request.query || {}) as { q?: string };
    const where = {
      ...(query.q ? { name: { contains: query.q.trim(), mode: 'insensitive' as const } } : {}),
      constituencies: { some: { versions: { some: { election: { sourceStatus: 'PUBLISHED' as const } } } } }
    };
    const [data, total] = await prisma.$transaction([
      prisma.state.findMany({ where, orderBy: { name: 'asc' }, skip, take: limit, select: { id: true, name: true, abbreviation: true, stateCode: true } }),
      prisma.state.count({ where })
    ]);
    return pageResponse(data, total, page, limit);
  });

  app.get('/api/v1/states/:id', async (request, reply) => {
    const { id } = request.params as { id: string };
    const state = await prisma.state.findFirst({ where: { id, constituencies: { some: { versions: { some: { election: { sourceStatus: 'PUBLISHED' } } } } } }, select: { id: true, name: true, abbreviation: true, stateCode: true } });
    if (!state) return reply.code(404).send({ error: 'STATE_NOT_FOUND' });
    return { data: state };
  });

  app.get('/api/v1/constituencies', async (request) => {
    const { page, limit, skip } = pagination(request);
    const query = (request.query || {}) as { stateId?: string; electionId?: string; q?: string };
    const where = {
      ...(query.stateId ? { stateId: query.stateId } : {}),
      ...(query.q ? { name: { contains: query.q.trim(), mode: 'insensitive' as const } } : {}),
      versions: { some: { ...(query.electionId ? { electionId: query.electionId } : {}), election: { sourceStatus: 'PUBLISHED' as const } } }
    };
    const [data, total] = await prisma.$transaction([
      prisma.constituency.findMany({ where, orderBy: [{ name: 'asc' }], skip, take: limit, select: { id: true, name: true, state: { select: { id: true, name: true, abbreviation: true } }, latitude: true, longitude: true } }),
      prisma.constituency.count({ where })
    ]);
    return pageResponse(data, total, page, limit);
  });

  app.get('/api/v1/constituencies/:id', async (request, reply) => {
    const { id } = request.params as { id: string };
    const constituency = await prisma.constituency.findFirst({ where: { id, versions: { some: { election: { sourceStatus: 'PUBLISHED' } } } }, select: { id: true, name: true, latitude: true, longitude: true, state: { select: { id: true, name: true, abbreviation: true, stateCode: true } } } });
    if (!constituency) return reply.code(404).send({ error: 'CONSTITUENCY_NOT_FOUND' });
    return { data: constituency };
  });

  app.get('/api/v1/constituency-versions', async (request) => {
    const { page, limit, skip } = pagination(request);
    const query = (request.query || {}) as { electionId?: string; constituencyId?: string };
    const where = { ...(query.electionId ? { electionId: query.electionId } : {}), ...(query.constituencyId ? { constituencyId: query.constituencyId } : {}), election: { sourceStatus: 'PUBLISHED' as const } };
    const [data, total] = await prisma.$transaction([
      prisma.constituencyVersion.findMany({ where, orderBy: [{ name: 'asc' }], skip, take: limit, select: { id: true, name: true, constituencyNumber: true, reservedCategory: true, delimitationVersion: true, constituency: { select: { id: true, name: true, state: { select: { id: true, name: true } } } }, election: { select: { id: true, name: true, electionType: true, year: true } } } }),
      prisma.constituencyVersion.count({ where })
    ]);
    return pageResponse(data, total, page, limit);
  });

  app.get('/api/v1/parties', async (request) => {
    const { page, limit, skip } = pagination(request);
    const query = (request.query || {}) as { q?: string };
    const where = { ...(query.q ? { name: { contains: query.q.trim(), mode: 'insensitive' as const } } : {}), results: { some: { election: { sourceStatus: 'PUBLISHED' as const } } } };
    const [data, total] = await prisma.$transaction([
      prisma.party.findMany({ where, orderBy: { name: 'asc' }, skip, take: limit, select: { id: true, name: true, abbreviation: true, symbolUrl: true, foundedYear: true, dissolvedYear: true } }),
      prisma.party.count({ where })
    ]);
    return pageResponse(data, total, page, limit);
  });

  app.get('/api/v1/parties/:id', async (request, reply) => {
    const { id } = request.params as { id: string };
    const party = await prisma.party.findFirst({ where: { id, results: { some: { election: { sourceStatus: 'PUBLISHED' } } } }, select: { id: true, name: true, abbreviation: true, symbolUrl: true, foundedYear: true, dissolvedYear: true } });
    if (!party) return reply.code(404).send({ error: 'PARTY_NOT_FOUND' });
    return { data: party };
  });

  app.get('/api/v1/candidates', async (request) => {
    const { page, limit, skip } = pagination(request);
    const query = (request.query || {}) as { q?: string; electionId?: string; partyId?: string };
    const where = {
      ...(query.q ? { name: { contains: query.q.trim(), mode: 'insensitive' as const } } : {}),
      results: { some: { ...(query.electionId ? { electionId: query.electionId } : {}), ...(query.partyId ? { partyId: query.partyId } : {}), election: { sourceStatus: 'PUBLISHED' as const } } }
    };
    const [data, total] = await prisma.$transaction([
      prisma.candidate.findMany({ where, orderBy: { name: 'asc' }, skip, take: limit, select: { id: true, name: true, gender: true, dateOfBirth: true, biography: true, photoUrl: true } }),
      prisma.candidate.count({ where })
    ]);
    return pageResponse(data, total, page, limit);
  });

  app.get('/api/v1/candidates/:id', async (request, reply) => {
    const { id } = request.params as { id: string };
    const candidate = await prisma.candidate.findFirst({ where: { id, results: { some: { election: { sourceStatus: 'PUBLISHED' } } } }, select: { id: true, name: true, gender: true, dateOfBirth: true, biography: true, photoUrl: true, results: { where: { election: { sourceStatus: 'PUBLISHED' } }, orderBy: [{ election: { year: 'desc' } }], select: { id: true, votes: true, voteShare: true, position: true, isWinner: true, election: { select: { id: true, name: true, year: true, electionType: true } }, constituencyVersion: { select: { id: true, name: true, constituency: { select: { id: true, name: true, state: { select: { id: true, name: true } } } } } }, party: { select: { id: true, name: true, abbreviation: true } } } } });
    if (!candidate) return reply.code(404).send({ error: 'CANDIDATE_NOT_FOUND' });
    return { data: candidate };
  });

  const resultWhere = (query: { electionId?: string; constituencyVersionId?: string; candidateId?: string; partyId?: string }) => ({
    ...(query.electionId ? { electionId: query.electionId } : {}),
    ...(query.constituencyVersionId ? { constituencyVersionId: query.constituencyVersionId } : {}),
    ...(query.candidateId ? { candidateId: query.candidateId } : {}),
    ...(query.partyId ? { partyId: query.partyId } : {}),
    election: { sourceStatus: 'PUBLISHED' as const }
  });

  app.get('/api/v1/results', async (request) => {
    const { page, limit, skip } = pagination(request);
    const query = (request.query || {}) as { electionId?: string; constituencyVersionId?: string; candidateId?: string; partyId?: string };
    const where = resultWhere(query);
    const [data, total] = await prisma.$transaction([
      prisma.candidateResult.findMany({ where, orderBy: [{ election: { year: 'desc' } }, { position: 'asc' }], skip, take: limit, select: { id: true, votes: true, voteShare: true, position: true, isWinner: true, election: { select: { id: true, name: true, year: true, electionType: true } }, constituencyVersion: { select: { id: true, name: true, constituencyNumber: true, constituency: { select: { id: true, name: true, state: { select: { id: true, name: true } } } } } }, candidate: { select: { id: true, name: true, gender: true, photoUrl: true } }, party: { select: { id: true, name: true, abbreviation: true, symbolUrl: true } }, sources: { select: { source: { select: { id: true, name: true, organization: true, url: true, publicationDate: true, retrievedAt: true, sourceType: true } } } } } }),
      prisma.candidateResult.count({ where })
    ]);
    return pageResponse(data, total, page, limit);
  });

  app.get('/api/v1/results/:id', async (request, reply) => {
    const { id } = request.params as { id: string };
    const result = await prisma.candidateResult.findFirst({ where: { id, election: { sourceStatus: 'PUBLISHED' } }, select: { id: true, votes: true, voteShare: true, position: true, isWinner: true, election: { select: { id: true, name: true, year: true, electionType: true } }, constituencyVersion: { select: { id: true, name: true, constituencyNumber: true, constituency: { select: { id: true, name: true, state: { select: { id: true, name: true } } } } } }, candidate: { select: { id: true, name: true, gender: true, photoUrl: true } }, party: { select: { id: true, name: true, abbreviation: true, symbolUrl: true } }, sources: { select: { source: { select: { id: true, name: true, organization: true, url: true, publicationDate: true, retrievedAt: true, sourceType: true } } } } });
    if (!result) return reply.code(404).send({ error: 'RESULT_NOT_FOUND' });
    return { data: result };
  });

  app.get('/api/v1/winners', async (request) => {
    const { page, limit, skip } = pagination(request);
    const query = (request.query || {}) as { electionId?: string; constituencyVersionId?: string; partyId?: string };
    const where = { ...resultWhere(query), isWinner: true };
    const [data, total] = await prisma.$transaction([
      prisma.candidateResult.findMany({ where, orderBy: [{ election: { year: 'desc' } }, { constituencyVersion: { name: 'asc' } }], skip, take: limit, select: { id: true, votes: true, voteShare: true, position: true, election: { select: { id: true, name: true, year: true, electionType: true } }, constituencyVersion: { select: { id: true, name: true, constituencyNumber: true, constituency: { select: { id: true, name: true, state: { select: { id: true, name: true } } } } } }, candidate: { select: { id: true, name: true, photoUrl: true } }, party: { select: { id: true, name: true, abbreviation: true, symbolUrl: true } } } }),
      prisma.candidateResult.count({ where })
    ]);
    return pageResponse(data, total, page, limit);
  });

  app.get('/api/v1/vote-shares', async (request) => {
    const { page, limit, skip } = pagination(request);
    const query = (request.query || {}) as { electionId?: string; partyId?: string; constituencyVersionId?: string };
    const where = resultWhere(query);
    const [data, total] = await prisma.$transaction([
      prisma.candidateResult.findMany({ where, orderBy: [{ election: { year: 'desc' } }, { voteShare: 'desc' }], skip, take: limit, select: { id: true, votes: true, voteShare: true, position: true, isWinner: true, election: { select: { id: true, name: true, year: true } }, constituencyVersion: { select: { id: true, name: true } }, candidate: { select: { id: true, name: true } }, party: { select: { id: true, name: true, abbreviation: true } } } }),
      prisma.candidateResult.count({ where })
    ]);
    return pageResponse(data, total, page, limit);
  });

  app.get('/api/v1/sources', async (request) => {
    const { page, limit, skip } = pagination(request);
    const dataWhere = { results: { some: { result: { election: { sourceStatus: 'PUBLISHED' as const } } } } };
    const [data, total] = await prisma.$transaction([
      prisma.dataSource.findMany({ where: dataWhere, orderBy: { retrievedAt: 'desc' }, skip, take: limit, select: { id: true, name: true, organization: true, url: true, publicationDate: true, retrievedAt: true, sourceType: true, _count: { select: { results: true } } } }),
      prisma.dataSource.count({ where: dataWhere })
    ]);
    return pageResponse(data, total, page, limit);
  });

  app.get('/api/v1/sources/:id', async (request, reply) => {
    const { id } = request.params as { id: string };
    const source = await prisma.dataSource.findFirst({ where: { id, results: { some: { result: { election: { sourceStatus: 'PUBLISHED' } } } } }, select: { id: true, name: true, organization: true, url: true, publicationDate: true, retrievedAt: true, sourceType: true, results: { where: { result: { election: { sourceStatus: 'PUBLISHED' } } }, take: 100, select: { result: { select: { id: true, election: { select: { id: true, name: true, year: true } }, candidate: { select: { id: true, name: true } }, constituencyVersion: { select: { id: true, name: true } }, votes: true, voteShare: true, position: true, isWinner: true } } } } });
    if (!source) return reply.code(404).send({ error: 'SOURCE_NOT_FOUND' });
    return { data: source };
  });
}
