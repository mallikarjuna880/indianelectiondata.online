import Fastify, { FastifyRequest } from 'fastify';
import cors from '@fastify/cors';
import sensible from '@fastify/sensible';
import { PrismaClient, Prisma } from '@prisma/client';
import { z } from 'zod';

const prisma = new PrismaClient();
const app = Fastify({ logger: true, trustProxy: true });

const idSchema = z.string().uuid();
const paginationSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(25),
});
const electionQuery = paginationSchema.extend({
  type: z.enum(['LOK_SABHA', 'ASSEMBLY', 'OTHER']).optional(),
  year: z.coerce.number().int().min(1900).max(2100).optional(),
  q: z.string().trim().min(1).max(100).optional(),
});
const resultQuery = paginationSchema.extend({
  stateId: z.string().uuid().optional(),
  partyId: z.string().uuid().optional(),
  q: z.string().trim().min(1).max(100).optional(),
});

function decimal(value: Prisma.Decimal | null | undefined) {
  return value == null ? null : Number(value.toString());
}

function serialize<T extends Record<string, unknown>>(obj: T): T {
  return JSON.parse(JSON.stringify(obj, (_key, value) => value instanceof Prisma.Decimal ? Number(value.toString()) : value));
}

function pagination(page: number, pageSize: number, total: number) {
  return { page, pageSize, total, totalPages: Math.ceil(total / pageSize), hasNextPage: page * pageSize < total, hasPreviousPage: page > 1 };
}

function parseQuery<T extends z.ZodTypeAny>(request: FastifyRequest, schema: T): z.infer<T> {
  const parsed = schema.safeParse(request.query);
  if (!parsed.success) throw app.httpErrors.badRequest(parsed.error.flatten());
  return parsed.data;
}

async function publicElection(id: string) {
  return prisma.election.findFirst({ where: { id, sourceStatus: 'PUBLISHED' } });
}

await app.register(cors, { origin: process.env.CORS_ORIGIN?.split(',').map(s => s.trim()) ?? true, credentials: true });
await app.register(sensible);

app.get('/health', async () => {
  const started = Date.now();
  await prisma.$queryRaw`SELECT 1`;
  return { status: 'ok', database: 'ok', service: 'indian-election-data-api', responseTimeMs: Date.now() - started };
});

app.get('/api/v1/elections', async (request) => {
  const q = parseQuery(request, electionQuery);
  const where: Prisma.ElectionWhereInput = { sourceStatus: 'PUBLISHED' };
  if (q.type) where.electionType = q.type;
  if (q.year) where.year = q.year;
  if (q.q) where.name = { contains: q.q, mode: 'insensitive' };
  const [data, total] = await prisma.$transaction([
    prisma.election.findMany({ where, orderBy: [{ year: 'desc' }, { name: 'asc' }], skip: (q.page - 1) * q.pageSize, take: q.pageSize, select: { id: true, name: true, electionType: true, year: true, electionDate: true, description: true, sourceStatus: true, _count: { select: { results: true, versions: true } } } }),
    prisma.election.count({ where })
  ]);
  return serialize({ data, meta: pagination(q.page, q.pageSize, total) });
});

app.get('/api/v1/elections/:id', async (request) => {
  const id = idSchema.safeParse((request.params as { id: string }).id);
  if (!id.success) throw app.httpErrors.badRequest('Invalid election id');
  const election = await prisma.election.findFirst({ where: { id: id.data, sourceStatus: 'PUBLISHED' }, include: { _count: { select: { versions: true, results: true } } } });
  if (!election) throw app.httpErrors.notFound('Election not found');
  return serialize({ data: election });
});

app.get('/api/v1/elections/:id/results', async (request) => {
  const id = idSchema.safeParse((request.params as { id: string }).id);
  if (!id.success) throw app.httpErrors.badRequest('Invalid election id');
  const q = parseQuery(request, resultQuery);
  if (!(await publicElection(id.data))) throw app.httpErrors.notFound('Election not found');
  const where: Prisma.CandidateResultWhereInput = { electionId: id.data };
  if (q.partyId) where.partyId = q.partyId;
  if (q.stateId) where.constituencyVersion = { constituency: { stateId: q.stateId } };
  if (q.q) where.constituencyVersion = { ...(where.constituencyVersion as object), name: { contains: q.q, mode: 'insensitive' } };
  const [data, total] = await prisma.$transaction([
    prisma.candidateResult.findMany({ where, orderBy: [{ constituencyVersion: { name: 'asc' } }, { position: 'asc' }], skip: (q.page - 1) * q.pageSize, take: q.pageSize, include: { candidate: { select: { id: true, name: true, gender: true, photoUrl: true } }, party: { select: { id: true, name: true, abbreviation: true, symbolUrl: true } }, constituencyVersion: { include: { constituency: { include: { state: true } } } }, sources: { include: { source: true } } } }),
    prisma.candidateResult.count({ where })
  ]);
  return serialize({ data, meta: pagination(q.page, q.pageSize, total) });
});

app.get('/api/v1/constituencies', async (request) => {
  const q = paginationSchema.extend({ stateId: z.string().uuid().optional(), electionId: z.string().uuid().optional(), search: z.string().trim().min(1).max(100).optional() });
  const p = parseQuery(request, q);
  const where: Prisma.ConstituencyWhereInput = {};
  if (p.stateId) where.stateId = p.stateId;
  if (p.search) where.name = { contains: p.search, mode: 'insensitive' };
  const [data, total] = await prisma.$transaction([
    prisma.constituency.findMany({ where, orderBy: { name: 'asc' }, skip: (p.page - 1) * p.pageSize, take: p.pageSize, include: { state: true, versions: p.electionId ? { where: { electionId: p.electionId } } : false } }),
    prisma.constituency.count({ where })
  ]);
  return serialize({ data, meta: pagination(p.page, p.pageSize, total) });
});

app.get('/api/v1/constituencies/:id', async (request) => {
  const id = idSchema.safeParse((request.params as { id: string }).id);
  if (!id.success) throw app.httpErrors.badRequest('Invalid constituency id');
  const data = await prisma.constituency.findUnique({ where: { id: id.data }, include: { state: true, versions: { include: { election: { select: { id: true, name: true, year: true, electionType: true, sourceStatus: true } } }, orderBy: { election: { year: 'desc' } } } } });
  if (!data) throw app.httpErrors.notFound('Constituency not found');
  data.versions = data.versions.filter(v => v.election.sourceStatus === 'PUBLISHED');
  return serialize({ data });
});

app.get('/api/v1/constituencies/:id/history', async (request) => {
  const id = idSchema.safeParse((request.params as { id: string }).id);
  if (!id.success) throw app.httpErrors.badRequest('Invalid constituency id');
  const constituency = await prisma.constituency.findUnique({ where: { id: id.data } });
  if (!constituency) throw app.httpErrors.notFound('Constituency not found');
  const versions = await prisma.constituencyVersion.findMany({ where: { constituencyId: id.data, election: { sourceStatus: 'PUBLISHED' } }, orderBy: { election: { year: 'desc' } }, include: { election: true, results: { orderBy: { position: 'asc' }, include: { candidate: true, party: true } }, statistics: true } });
  return serialize({ data: versions });
});

app.get('/api/v1/candidates', async (request) => {
  const q = paginationSchema.extend({ search: z.string().trim().min(1).max(100).optional() });
  const p = parseQuery(request, q);
  const where: Prisma.CandidateWhereInput = p.search ? { name: { contains: p.search, mode: 'insensitive' } } : {};
  const [data, total] = await prisma.$transaction([
    prisma.candidate.findMany({ where, orderBy: { name: 'asc' }, skip: (p.page - 1) * p.pageSize, take: p.pageSize, include: { results: { where: { election: { sourceStatus: 'PUBLISHED' } }, orderBy: { election: { year: 'desc' } }, take: 10, include: { election: true, party: true, constituencyVersion: true } } } }),
    prisma.candidate.count({ where })
  ]);
  return serialize({ data, meta: pagination(p.page, p.pageSize, total) });
});

app.get('/api/v1/candidates/:id', async (request) => {
  const id = idSchema.safeParse((request.params as { id: string }).id);
  if (!id.success) throw app.httpErrors.badRequest('Invalid candidate id');
  const data = await prisma.candidate.findUnique({ where: { id: id.data }, include: { results: { where: { election: { sourceStatus: 'PUBLISHED' } }, orderBy: { election: { year: 'desc' } }, include: { election: true, party: true, constituencyVersion: { include: { constituency: { include: { state: true } } } }, sources: { include: { source: true } } } } } });
  if (!data) throw app.httpErrors.notFound('Candidate not found');
  return serialize({ data });
});

app.get('/api/v1/parties', async (request) => {
  const q = paginationSchema.extend({ search: z.string().trim().min(1).max(100).optional() });
  const p = parseQuery(request, q);
  const where: Prisma.PartyWhereInput = p.search ? { name: { contains: p.search, mode: 'insensitive' } } : {};
  const [data, total] = await prisma.$transaction([
    prisma.party.findMany({ where, orderBy: { name: 'asc' }, skip: (p.page - 1) * p.pageSize, take: p.pageSize, include: { _count: { select: { results: true } } } }),
    prisma.party.count({ where })
  ]);
  return serialize({ data, meta: pagination(p.page, p.pageSize, total) });
});

app.get('/api/v1/parties/:id', async (request) => {
  const id = idSchema.safeParse((request.params as { id: string }).id);
  if (!id.success) throw app.httpErrors.badRequest('Invalid party id');
  const data = await prisma.party.findUnique({ where: { id: id.data }, include: { results: { where: { election: { sourceStatus: 'PUBLISHED' } }, orderBy: { election: { year: 'desc' } }, include: { election: true, candidate: true, constituencyVersion: true } } } });
  if (!data) throw app.httpErrors.notFound('Party not found');
  return serialize({ data });
});

app.get('/api/v1/states', async () => {
  const data = await prisma.state.findMany({ orderBy: { name: 'asc' }, include: { _count: { select: { constituencies: true } } } });
  return serialize({ data });
});

app.get('/api/v1/states/:id', async (request) => {
  const id = idSchema.safeParse((request.params as { id: string }).id);
  if (!id.success) throw app.httpErrors.badRequest('Invalid state id');
  const data = await prisma.state.findUnique({ where: { id: id.data }, include: { constituencies: { orderBy: { name: 'asc' } } } });
  if (!data) throw app.httpErrors.notFound('State not found');
  return serialize({ data });
});

app.get('/api/v1/search', async (request) => {
  const parsed = z.object({ q: z.string().trim().min(2).max(100), limit: z.coerce.number().int().min(1).max(50).default(20) }).safeParse(request.query);
  if (!parsed.success) throw app.httpErrors.badRequest(parsed.error.flatten());
  const { q, limit } = parsed.data;
  const [elections, states, constituencies, parties, candidates] = await Promise.all([
    prisma.election.findMany({ where: { sourceStatus: 'PUBLISHED', name: { contains: q, mode: 'insensitive' } }, take: limit, select: { id: true, name: true, year: true, electionType: true } }),
    prisma.state.findMany({ where: { name: { contains: q, mode: 'insensitive' } }, take: limit, select: { id: true, name: true, abbreviation: true } }),
    prisma.constituency.findMany({ where: { name: { contains: q, mode: 'insensitive' } }, take: limit, select: { id: true, name: true, state: { select: { id: true, name: true } } } }),
    prisma.party.findMany({ where: { name: { contains: q, mode: 'insensitive' } }, take: limit, select: { id: true, name: true, abbreviation: true } }),
    prisma.candidate.findMany({ where: { name: { contains: q, mode: 'insensitive' } }, take: limit, select: { id: true, name: true } })
  ]);
  return serialize({ data: { elections, states, constituencies, parties, candidates } });
});

app.get('/api/v1/analytics/party-vote-share', async (request) => {
  const p = parseQuery(request, z.object({ electionId: z.string().uuid(), stateId: z.string().uuid().optional() }));
  if (!(await publicElection(p.electionId))) throw app.httpErrors.notFound('Election not found');
  const rows = await prisma.candidateResult.findMany({ where: { electionId: p.electionId, ...(p.stateId ? { constituencyVersion: { constituency: { stateId: p.stateId } } } : {}) }, select: { votes: true, partyId: true, party: { select: { id: true, name: true, abbreviation: true } } } });
  const totals = new Map<string, { party: unknown; votes: number }>();
  let totalVotes = 0;
  for (const row of rows) { totalVotes += row.votes; const key = row.partyId ?? 'IND/OTHER'; const current = totals.get(key) ?? { party: row.party ?? { id: null, name: 'Independent / Other', abbreviation: null }, votes: 0 }; current.votes += row.votes; totals.set(key, current); }
  const data = [...totals.values()].sort((a,b) => b.votes - a.votes).map(x => ({ ...x.party as object, votes: x.votes, voteShare: totalVotes ? Number((x.votes / totalVotes * 100).toFixed(4)) : 0 }));
  return { data, meta: { totalVotes } };
});

app.get('/api/v1/analytics/seat-trends', async (request) => {
  const p = parseQuery(request, z.object({ type: z.enum(['LOK_SABHA','ASSEMBLY','OTHER']).optional(), stateId: z.string().uuid().optional() }));
  const elections = await prisma.election.findMany({ where: { sourceStatus: 'PUBLISHED', ...(p.type ? { electionType: p.type } : {}) }, orderBy: { year: 'asc' }, select: { id: true, name: true, year: true, electionType: true } });
  const data = [];
  for (const election of elections) {
    const results = await prisma.candidateResult.findMany({ where: { electionId: election.id, isWinner: true, ...(p.stateId ? { constituencyVersion: { constituency: { stateId: p.stateId } } } : {}) }, select: { partyId: true, party: { select: { id: true, name: true, abbreviation: true } } } });
    const counts = new Map<string, { party: unknown; seats: number }>();
    for (const result of results) { const key = result.partyId ?? 'IND/OTHER'; const current = counts.get(key) ?? { party: result.party ?? { id: null, name: 'Independent / Other', abbreviation: null }, seats: 0 }; current.seats++; counts.set(key, current); }
    data.push({ election, parties: [...counts.values()].sort((a,b) => b.seats - a.seats) });
  }
  return serialize({ data });
});

app.get('/api/v1/analytics/turnout', async (request) => {
  const p = parseQuery(request, z.object({ electionId: z.string().uuid(), stateId: z.string().uuid().optional() }));
  if (!(await publicElection(p.electionId))) throw app.httpErrors.notFound('Election not found');
  const stats = await prisma.constituencyStatistic.findMany({ where: { electionId: p.electionId, ...(p.stateId ? { constituencyVersion: { constituency: { stateId: p.stateId } } } : {}) }, select: { electors: true, votesPolled: true, validVotes: true, notaVotes: true, turnoutPercentage: true, constituencyVersion: { select: { id: true, name: true } } } });
  const electors = stats.reduce((n,s) => n + (s.electors ?? 0), 0); const votesPolled = stats.reduce((n,s) => n + (s.votesPolled ?? 0), 0); const validVotes = stats.reduce((n,s) => n + (s.validVotes ?? 0), 0); const notaVotes = stats.reduce((n,s) => n + (s.notaVotes ?? 0), 0);
  return serialize({ data: { electors, votesPolled, validVotes, notaVotes, turnoutPercentage: electors ? Number((votesPolled / electors * 100).toFixed(4)) : null, constituencies: stats } });
});

app.setErrorHandler((error, request, reply) => {
  request.log.error(error);
  const status = error.statusCode && error.statusCode >= 400 ? error.statusCode : 500;
  reply.status(status).send({ error: { code: error.code ?? 'INTERNAL_ERROR', message: status >= 500 ? 'Internal server error' : error.message } });
});

app.addHook('onClose', async () => prisma.$disconnect());

const port = Number(process.env.PORT || 4000);
const host = process.env.HOST || '0.0.0.0';
app.listen({ port, host }).catch((err) => { app.log.error(err); process.exit(1); });
