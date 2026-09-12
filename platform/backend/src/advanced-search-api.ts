import { prisma } from './db.js';

export function searchPagination(q: Record<string, unknown>) {
  const page = Math.max(1, Math.min(100000, Number(q.page) || 1));
  const pageSize = Math.max(1, Math.min(100, Number(q.pageSize) || 25));
  return { page, pageSize, skip: (page - 1) * pageSize, take: pageSize };
}

const pageMeta = (page: number, pageSize: number, total: number) => ({ page, pageSize, total, totalPages: Math.ceil(total / pageSize) });

export async function advancedSearch(q: Record<string, unknown>) {
  const { page, pageSize, skip, take } = searchPagination(q);
  const text = String(q.q || '').trim();
  const type = String(q.type || '').trim().toLowerCase();
  const year = Number(q.year) || undefined;
  const electionType = String(q.electionType || '').trim();
  const stateId = String(q.stateId || '').trim();
  const partyId = String(q.partyId || '').trim();

  if (text.length < 2) return { data: [], filters: { q: text, type, year, electionType, stateId, partyId }, pagination: pageMeta(page, pageSize, 0), message: 'q must contain at least 2 characters' };

  const election: Record<string, unknown> = { sourceStatus: 'PUBLISHED' };
  if (year) election.year = year;
  if (electionType) election.electionType = electionType as any;

  const result: Array<Record<string, unknown>> = [];
  const limit = Math.min(100, skip + take);

  if (!type || type === 'candidate') {
    const rows = await prisma.candidate.findMany({
      where: {
        name: { contains: text, mode: 'insensitive' },
        ...(stateId || partyId ? { results: { some: { election, ...(partyId ? { partyId } : {}), ...(stateId ? { constituencyVersion: { constituency: { stateId } } } : {}) } } } : { results: { some: { election } } })
      },
      take: limit,
      orderBy: { name: 'asc' }
    });
    result.push(...rows.slice(skip, skip + take).map(x => ({ type: 'candidate', id: x.id, name: x.name })));
  }

  if (!type || type === 'party') {
    const rows = await prisma.party.findMany({
      where: {
        OR: [{ name: { contains: text, mode: 'insensitive' } }, { abbreviation: { contains: text, mode: 'insensitive' } }],
        results: { some: { election } }
      }, take: limit, orderBy: { name: 'asc' }
    });
    result.push(...rows.slice(skip, skip + take).map(x => ({ type: 'party', id: x.id, name: x.name, abbreviation: x.abbreviation })));
  }

  if (!type || type === 'constituency') {
    const rows = await prisma.constituency.findMany({
      where: { name: { contains: text, mode: 'insensitive' }, ...(stateId ? { stateId } : {}), versions: { some: { election } } },
      take: limit, orderBy: { name: 'asc' }, include: { state: true }
    });
    result.push(...rows.slice(skip, skip + take).map(x => ({ type: 'constituency', id: x.id, name: x.name, state: x.state.name })));
  }

  if (!type || type === 'state') {
    const rows = await prisma.state.findMany({
      where: { name: { contains: text, mode: 'insensitive' }, ...(stateId ? { id: stateId } : {}), constituencies: { some: { versions: { some: { election } } } } },
      take: limit, orderBy: { name: 'asc' }
    });
    result.push(...rows.slice(skip, skip + take).map(x => ({ type: 'state', id: x.id, name: x.name })));
  }

  return { data: result, filters: { q: text, type: type || 'all', year, electionType, stateId, partyId }, pagination: pageMeta(page, pageSize, result.length) };
}
