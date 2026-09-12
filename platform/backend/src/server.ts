import Fastify from 'fastify';
import cookie from '@fastify/cookie';
import multipart from '@fastify/multipart';
import rateLimit from '@fastify/rate-limit';
import { prisma } from './db.js';
import { getAdminUser, login, logout, requireAdmin } from './admin-auth.js';
import { parseElectionFile, validateRecord, normalizeRecord } from './importer.js';

const app = Fastify({ logger: true, bodyLimit: 1024 * 1024 });
await app.register(cookie, { secret: process.env.COOKIE_SECRET || 'change-me-in-production' });
await app.register(multipart, { limits: { fileSize: Number(process.env.MAX_IMPORT_BYTES || 10 * 1024 * 1024), files: 1 } });
await app.register(rateLimit, { global: false });

const mutateRoles = ['SUPER_ADMIN', 'ADMIN', 'DATA_EDITOR'] as const;
const reviewRoles = ['SUPER_ADMIN', 'ADMIN'] as const;
const publishRoles = ['SUPER_ADMIN', 'ADMIN'] as const;

async function audit(userId: string, action: string, entityType: string, entityId?: string, oldValue?: unknown, newValue?: unknown) {
  await prisma.auditLog.create({ data: { userId, action, entityType, entityId, oldValue: oldValue as any, newValue: newValue as any } });
}

app.get('/health', async () => ({ status: 'ok', service: 'indian-election-data-api' }));

app.post('/api/v1/admin/login', { config: { rateLimit: { max: 5, timeWindow: '1 minute' } } }, async (request, reply) => {
  const body = request.body as { email?: string; password?: string };
  if (!body?.email || !body?.password) return reply.code(400).send({ error: 'EMAIL_AND_PASSWORD_REQUIRED' });
  if (!(await login(body.email, body.password, reply))) return reply.code(401).send({ error: 'INVALID_CREDENTIALS' });
  return { ok: true };
});

app.post('/api/v1/admin/logout', async (request, reply) => {
  await logout(request, reply);
  return { ok: true };
});

app.get('/api/v1/admin/me', async (request, reply) => {
  const user = await requireAdmin(request, reply);
  return user ? { user } : undefined;
});

app.post('/api/v1/admin/imports', async (request, reply) => {
  const user = await requireAdmin(request, reply, [...mutateRoles]);
  if (!user) return;
  const part = await request.file();
  if (!part) return reply.code(400).send({ error: 'FILE_REQUIRED' });
  const buffer = await part.toBuffer();
  let records;
  try { records = parseElectionFile(part.filename, buffer); } catch (error) { return reply.code(400).send({ error: 'INVALID_FILE', message: String(error) }); }
  if (records.length === 0) return reply.code(400).send({ error: 'EMPTY_FILE' });
  if (records.length > 100000) return reply.code(400).send({ error: 'TOO_MANY_ROWS', maxRows: 100000 });

  const batch = await prisma.importBatch.create({
    data: {
      filename: part.filename,
      fileType: part.mimetype || 'application/octet-stream',
      uploadedById: user.id,
      totalRows: records.length,
      metadata: { columns: Object.keys(records[0] || {}) }
    }
  });
  await prisma.importRow.createMany({
    data: records.map((payload, index) => ({ batchId: batch.id, rowNumber: index + 2, payload: payload as any }))
  });
  await audit(user.id, 'IMPORT_UPLOADED', 'ImportBatch', batch.id, undefined, { filename: part.filename, rows: records.length });
  return reply.code(201).send({ id: batch.id, status: batch.status, totalRows: records.length });
});

app.get('/api/v1/admin/imports', async (request, reply) => {
  const user = await requireAdmin(request, reply);
  if (!user) return;
  const batches = await prisma.importBatch.findMany({ orderBy: { uploadedAt: 'desc' }, take: 100, select: { id: true, filename: true, status: true, totalRows: true, validRows: true, errorRows: true, uploadedAt: true, validatedAt: true, approvedAt: true, publishedAt: true } });
  return { data: batches };
});

app.get('/api/v1/admin/imports/:id', async (request, reply) => {
  const user = await requireAdmin(request, reply);
  if (!user) return;
  const { id } = request.params as { id: string };
  const batch = await prisma.importBatch.findUnique({ where: { id }, include: { reviews: { orderBy: { createdAt: 'desc' }, include: { reviewer: { select: { email: true, role: true } } } } } });
  if (!batch) return reply.code(404).send({ error: 'IMPORT_NOT_FOUND' });
  const errors = await prisma.importRow.findMany({ where: { batchId: id, status: 'ERROR' }, orderBy: { rowNumber: 'asc' }, take: 500, select: { rowNumber: true, errors: true, payload: true } });
  return { batch, errors };
});

app.post('/api/v1/admin/imports/:id/validate', async (request, reply) => {
  const user = await requireAdmin(request, reply, [...mutateRoles]);
  if (!user) return;
  const { id } = request.params as { id: string };
  const batch = await prisma.importBatch.findUnique({ where: { id } });
  if (!batch) return reply.code(404).send({ error: 'IMPORT_NOT_FOUND' });
  if (['APPROVED', 'PUBLISHED'].includes(batch.status)) return reply.code(409).send({ error: 'IMPORT_ALREADY_APPROVED' });
  const rows = await prisma.importRow.findMany({ where: { batchId: id }, orderBy: { rowNumber: 'asc' } });
  let valid = 0;
  let errors = 0;
  await prisma.$transaction(async (tx) => {
    for (const row of rows) {
      const payload = row.payload as Record<string, unknown>;
      const rowErrors = validateRecord(payload);
      if (rowErrors.length) {
        errors++;
        await tx.importRow.update({ where: { id: row.id }, data: { status: 'ERROR', errors: rowErrors } });
      } else {
        valid++;
        await tx.importRow.update({ where: { id: row.id }, data: { status: 'VALID', errors: null, normalized: normalizeRecord(payload) } });
      }
    }
    await tx.importBatch.update({ where: { id }, data: { status: valid === rows.length ? 'VALIDATED' : 'REJECTED', validRows: valid, errorRows: errors, validatedAt: new Date() } });
  });
  await audit(user.id, 'IMPORT_VALIDATED', 'ImportBatch', id, { totalRows: rows.length }, { validRows: valid, errorRows: errors });
  return { id, status: valid === rows.length ? 'VALIDATED' : 'REJECTED', validRows: valid, errorRows: errors };
});

app.post('/api/v1/admin/imports/:id/review', async (request, reply) => {
  const user = await requireAdmin(request, reply, [...reviewRoles]);
  if (!user) return;
  const { id } = request.params as { id: string };
  const body = request.body as { decision?: 'APPROVE' | 'REJECT'; comment?: string };
  if (!body?.decision) return reply.code(400).send({ error: 'DECISION_REQUIRED' });
  const batch = await prisma.importBatch.findUnique({ where: { id } });
  if (!batch) return reply.code(404).send({ error: 'IMPORT_NOT_FOUND' });
  if (batch.status !== 'VALIDATED') return reply.code(409).send({ error: 'IMPORT_MUST_BE_VALIDATED' });
  if (body.decision === 'REJECT') {
    await prisma.$transaction([
      prisma.importReview.create({ data: { batchId: id, reviewerId: user.id, decision: 'REJECT', comment: body.comment } }),
      prisma.importBatch.update({ where: { id }, data: { status: 'REJECTED' } })
    ]);
    await audit(user.id, 'IMPORT_REJECTED', 'ImportBatch', id, undefined, { comment: body.comment });
    return { id, status: 'REJECTED' };
  }
  await prisma.$transaction([
    prisma.importReview.create({ data: { batchId: id, reviewerId: user.id, decision: 'APPROVE', comment: body.comment } }),
    prisma.importBatch.update({ where: { id }, data: { status: 'APPROVED', approvedAt: new Date() } })
  ]);
  await audit(user.id, 'IMPORT_APPROVED', 'ImportBatch', id, undefined, { comment: body.comment });
  return { id, status: 'APPROVED' };
});

app.post('/api/v1/admin/imports/:id/publish', async (request, reply) => {
  const user = await requireAdmin(request, reply, [...publishRoles]);
  if (!user) return;
  const { id } = request.params as { id: string };
  const body = request.body as { sourceName?: string; organization?: string; sourceUrl?: string; electionId?: string };
  const batch = await prisma.importBatch.findUnique({ where: { id }, include: { rows: { where: { status: 'VALID' } } } });
  if (!batch) return reply.code(404).send({ error: 'IMPORT_NOT_FOUND' });
  if (batch.status !== 'APPROVED') return reply.code(409).send({ error: 'IMPORT_MUST_BE_APPROVED' });
  if (!body?.sourceName || !body?.electionId) return reply.code(400).send({ error: 'SOURCE_NAME_AND_ELECTION_ID_REQUIRED' });

  const election = await prisma.election.findUnique({ where: { id: body.electionId } });
  if (!election) return reply.code(400).send({ error: 'ELECTION_NOT_FOUND' });
  if (batch.rows.length !== batch.totalRows) return reply.code(409).send({ error: 'ALL_ROWS_MUST_BE_VALID' });

  await prisma.$transaction(async (tx) => {
    const source = await tx.dataSource.create({ data: { name: body.sourceName!, organization: body.organization, url: body.sourceUrl, sourceType: 'IMPORT' } });
    for (const row of batch.rows) {
      const r = row.normalized as any;
      if (r.electionId !== body.electionId) throw new Error(`Row ${row.rowNumber} electionId does not match publish election`);
      await tx.candidateResult.upsert({
        where: { electionId_constituencyVersionId_candidateId: { electionId: r.electionId, constituencyVersionId: r.constituencyVersionId, candidateId: r.candidateId } },
        create: { electionId: r.electionId, constituencyVersionId: r.constituencyVersionId, candidateId: r.candidateId, partyId: r.partyId, votes: r.votes, voteShare: r.voteShare, position: r.position, isWinner: r.isWinner, sources: { create: { sourceId: source.id } } },
        update: { partyId: r.partyId, votes: r.votes, voteShare: r.voteShare, position: r.position, isWinner: r.isWinner, sources: { connectOrCreate: { where: { resultId_sourceId: { resultId: row.id, sourceId: source.id } }, create: { sourceId: source.id } } } }
      });
    }
    await tx.election.update({ where: { id: body.electionId }, data: { sourceStatus: 'PUBLISHED' } });
    await tx.importBatch.update({ where: { id }, data: { electionId: body.electionId, sourceId: source.id, status: 'PUBLISHED', publishedAt: new Date() } });
  });
  await audit(user.id, 'IMPORT_PUBLISHED', 'ImportBatch', id, undefined, { electionId: body.electionId, source: body.sourceName });
  return { id, status: 'PUBLISHED', electionId: body.electionId };
});

app.get('/api/v1/elections', async () => ({ data: await prisma.election.findMany({ where: { sourceStatus: 'PUBLISHED' }, orderBy: [{ year: 'desc' }, { name: 'asc' }] }) }));
app.get('/api/v1/search', async (request) => { const { q = '' } = request.query as { q?: string }; return { query: q, data: [] }; });
app.get('/api/v1/constituencies/:id/history', async (request) => { const { id } = request.params as { id: string }; return { constituencyId: id, elections: [] }; });

app.addHook('onClose', async () => { await prisma.$disconnect(); });
const port = Number(process.env.PORT || 4000);
await app.listen({ port, host: '0.0.0.0' });
