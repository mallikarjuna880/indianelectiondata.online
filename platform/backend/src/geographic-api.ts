import { prisma } from './db.js';

export async function geographicExplorer(electionId?: string) {
  const election = electionId
    ? await prisma.election.findFirst({ where: { id: electionId, sourceStatus: 'PUBLISHED' } })
    : await prisma.election.findFirst({ where: { sourceStatus: 'PUBLISHED' }, orderBy: [{ year: 'desc' }, { name: 'asc' }] });
  if (!election) return null;

  const rows = await prisma.candidateResult.findMany({
    where: { electionId: election.id, isWinner: true },
    select: {
      partyId: true,
      party: { select: { id: true, name: true, abbreviation: true } },
      votes: true,
      constituencyVersion: { select: { constituency: { select: { id: true, name: true, state: { select: { id: true, name: true } } } } } }
    }
  });

  const stateMap = new Map<string, { id: string; name: string; seats: number; parties: Map<string, { id: string; name: string; abbreviation: string | null; seats: number }> }>();
  for (const r of rows) {
    const s = r.constituencyVersion.constituency.state;
    if (!s) continue;
    const state = stateMap.get(s.id) || { id: s.id, name: s.name, seats: 0, parties: new Map() };
    state.seats++;
    if (r.party) {
      const p = state.parties.get(r.party.id) || { ...r.party, seats: 0 };
      p.seats++;
      state.parties.set(r.party.id, p);
    }
    stateMap.set(s.id, state);
  }

  const states = [...stateMap.values()].map(s => ({
    id: s.id,
    name: s.name,
    seats: s.seats,
    parties: [...s.parties.values()].sort((a, b) => b.seats - a.seats)
  })).sort((a, b) => b.seats - a.seats || a.name.localeCompare(b.name));

  return { election, states, totalMappedSeats: rows.length };
}

export async function geographicState(stateId: string, electionId?: string) {
  const election = electionId
    ? await prisma.election.findFirst({ where: { id: electionId, sourceStatus: 'PUBLISHED' } })
    : await prisma.election.findFirst({ where: { sourceStatus: 'PUBLISHED' }, orderBy: [{ year: 'desc' }, { name: 'asc' }] });
  if (!election) return null;

  const state = await prisma.state.findUnique({ where: { id: stateId } });
  if (!state) return null;
  const versions = await prisma.constituencyVersion.findMany({
    where: { electionId: election.id, constituency: { stateId } },
    include: { constituency: true, results: { where: { isWinner: true }, include: { candidate: true, party: true }, take: 1 } },
    orderBy: { constituencyNumber: 'asc' }
  });

  return {
    election,
    state,
    constituencies: versions.map(v => ({
      id: v.constituency.id,
      name: v.name,
      number: v.constituencyNumber,
      reservedCategory: v.reservedCategory,
      winner: v.results[0] || null
    }))
  };
}
