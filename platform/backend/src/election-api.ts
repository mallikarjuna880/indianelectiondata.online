import { prisma } from './db.js';

export type Page = { page: number; pageSize: number; total: number; totalPages: number };

export function pagination(query: Record<string, unknown>): { skip: number; take: number; page: number; pageSize: number } {
  const page = Math.max(1, Math.min(100000, Number(query.page) || 1));
  const pageSize = Math.max(1, Math.min(100, Number(query.pageSize) || 25));
  return { page, pageSize, skip: (page - 1) * pageSize, take: pageSize };
}

export async function listStates(query: Record<string, unknown>) {
  const { skip, take, page, pageSize } = pagination(query); const q = String(query.q || '').trim(); const where = q ? { name: { contains: q, mode: 'insensitive' as const } } : {};
  const [data, total] = await prisma.$transaction([prisma.state.findMany({ where, skip, take, orderBy: { name: 'asc' }, include: { _count: { select: { constituencies: true } } } }), prisma.state.count({ where })]); return { data, pagination: pageMeta(page, pageSize, total) };
}
export async function listConstituencies(stateId: string | undefined, query: Record<string, unknown>) {
  const { skip, take, page, pageSize } = pagination(query); const q = String(query.q || '').trim(); const where = { ...(stateId ? { stateId } : {}), ...(q ? { name: { contains: q, mode: 'insensitive' as const } } : {}) };
  const [data, total] = await prisma.$transaction([prisma.constituency.findMany({ where, skip, take, orderBy: { name: 'asc' }, include: { state: true } }), prisma.constituency.count({ where })]); return { data, pagination: pageMeta(page, pageSize, total) };
}
export async function constituencyDetail(id: string) { return prisma.constituency.findUnique({ where: { id }, include: { state: true, versions: { where: { election: { sourceStatus: 'PUBLISHED' } }, include: { election: true } } } }); }
export async function electionResults(electionId: string, query: Record<string, unknown>) {
  const { skip, take, page, pageSize } = pagination(query); const constituencyVersionId = String(query.constituencyVersionId || ''); const partyId = String(query.partyId || '');
  const published = await prisma.election.findFirst({ where: { id: electionId, sourceStatus: 'PUBLISHED' }, select: { id: true } });
  if (!published) return { data: [], pagination: pageMeta(page, pageSize, 0) };
  const where = { electionId, ...(constituencyVersionId ? { constituencyVersionId } : {}), ...(partyId ? { partyId } : {}) };
  const [data, total] = await prisma.$transaction([prisma.candidateResult.findMany({ where, skip, take, orderBy: [{ constituencyVersionId: 'asc' }, { position: 'asc' }], include: { candidate: true, party: true, constituencyVersion: { include: { constituency: { include: { state: true } } } } } }), prisma.candidateResult.count({ where })]); return { data, pagination: pageMeta(page, pageSize, total) };
}
export async function constituencyResults(id: string, electionId?: string) {
  const versionWhere = { constituencyId: id, election: { sourceStatus: 'PUBLISHED' as const }, ...(electionId ? { electionId } : {}) };
  const versions = await prisma.constituencyVersion.findMany({ where: versionWhere, include: { election: true, statistics: true, results: { orderBy: { position: 'asc' }, include: { candidate: true, party: true } } } }); return versions.sort((a, b) => Number(b.election.year) - Number(a.election.year));
}
export async function constituencyHistory(id: string) {
  const versions = await prisma.constituencyVersion.findMany({ where: { constituencyId: id, election: { sourceStatus: 'PUBLISHED' } }, include: { election: true, statistics: true, results: { orderBy: { position: 'asc' }, take: 2, include: { candidate: true, party: true } } } });
  return versions.sort((a, b) => Number(b.election.year) - Number(a.election.year)).map(v => ({ election: v.election, constituencyVersion: { id: v.id, name: v.name, number: v.constituencyNumber, reservedCategory: v.reservedCategory }, statistics: v.statistics[0] || null, winner: v.results[0] || null, runnerUp: v.results[1] || null, margin: v.results[0] && v.results[1] ? v.results[0].votes - v.results[1].votes : null }));
}
export async function partyPerformance(partyId: string, query: Record<string, unknown>) {
  const { skip, take, page, pageSize } = pagination(query); const year = Number(query.year) || undefined; const electionType = String(query.electionType || ''); const electionWhere: Record<string, unknown> = { sourceStatus: 'PUBLISHED' }; if (year) electionWhere.year = year; if (electionType) electionWhere.electionType = electionType as any;
  const where = { partyId, election: electionWhere }; const grouped = await prisma.candidateResult.groupBy({ by: ['electionId'], where, _sum: { votes: true }, _count: { _all: true } }); const ids = grouped.map(x => x.electionId); const elections = await prisma.election.findMany({ where: { id: { in: ids }, sourceStatus: 'PUBLISHED' }, orderBy: [{ year: 'desc' }, { name: 'asc' }] }); const rows = elections.map(e => { const g = grouped.find(x => x.electionId === e.id); return { election: e, votes: g?._sum.votes || 0, candidates: g?._count._all || 0 }; }).slice(skip, skip + take); return { data: rows, pagination: pageMeta(page, pageSize, grouped.length) };
}
export async function search(query: Record<string, unknown>) {
  const { skip, take, page, pageSize } = pagination(query); const q = String(query.q || '').trim(); if (q.length < 2) return { data: [], pagination: pageMeta(page, pageSize, 0), message: 'q must contain at least 2 characters' };
  const [states, constituencies, candidates, parties] = await Promise.all([
    prisma.state.findMany({ where: { name: { contains: q, mode: 'insensitive' } }, take: 100 }),
    prisma.constituency.findMany({ where: { name: { contains: q, mode: 'insensitive' } }, take: 100, include: { state: true } }),
    prisma.candidate.findMany({ where: { name: { contains: q, mode: 'insensitive' } }, take: 100 }),
    prisma.party.findMany({ where: { OR: [{ name: { contains: q, mode: 'insensitive' } }, { abbreviation: { contains: q, mode: 'insensitive' } }] }, take: 100 })
  ]);
  const all = [...states.map(x => ({ type: 'state', id: x.id, name: x.name, state: null })), ...constituencies.map(x => ({ type: 'constituency', id: x.id, name: x.name, state: x.state.name })), ...candidates.map(x => ({ type: 'candidate', id: x.id, name: x.name, state: null })), ...parties.map(x => ({ type: 'party', id: x.id, name: x.name, abbreviation: x.abbreviation }))]; return { data: all.slice(skip, skip + take), pagination: pageMeta(page, pageSize, all.length) };
}
export async function publishedElections(query: Record<string, unknown>) { const { skip, take, page, pageSize } = pagination(query); const type = String(query.electionType || ''); const where = { sourceStatus: 'PUBLISHED' as const, ...(type ? { electionType: type as any } : {}) }; const [data, total] = await prisma.$transaction([prisma.election.findMany({ where, skip, take, orderBy: [{ year: 'desc' }, { name: 'asc' }] }), prisma.election.count({ where })]); return { data, pagination: pageMeta(page, pageSize, total) }; }
export async function electionSummary(id: string) { const election = await prisma.election.findFirst({ where: { id, sourceStatus: 'PUBLISHED' }, include: { _count: { select: { results: true, versions: true } } } }); if (!election) return null; const stats = await prisma.constituencyStatistic.aggregate({ where: { electionId: id }, _sum: { electors: true, votesPolled: true, validVotes: true, notaVotes: true }, _avg: { turnoutPercentage: true } }); return { election, statistics: stats }; }
function pageMeta(page: number, pageSize: number, total: number): Page { return { page, pageSize, total, totalPages: Math.ceil(total / pageSize) }; }
