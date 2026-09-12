import { prisma } from './db.js';

export async function historicalTrends() {
  const elections = await prisma.election.findMany({ where: { sourceStatus: 'PUBLISHED' }, orderBy: [{ year: 'asc' }, { name: 'asc' }] });
  const ids = elections.map(e => e.id);
  if (!ids.length) return { elections: [], parties: [], states: [] };
  const [rows, stats] = await Promise.all([
    prisma.candidateResult.findMany({ where: { electionId: { in: ids } }, select: { electionId: true, partyId: true, votes: true, isWinner: true, party: { select: { id: true, name: true, abbreviation: true } }, constituencyVersion: { select: { constituency: { select: { state: { select: { id: true, name: true } } } } } } } }),
    prisma.constituencyStatistic.findMany({ where: { electionId: { in: ids } }, select: { electionId: true, electors: true, votesPolled: true, validVotes: true, notaVotes: true } })
  ]);
  const statMap = new Map<string, { electors: number; votesPolled: number; validVotes: number; notaVotes: number }>();
  for (const s of stats) { const x = statMap.get(s.electionId) || { electors: 0, votesPolled: 0, validVotes: 0, notaVotes: 0 }; x.electors += Number(s.electors || 0); x.votesPolled += Number(s.votesPolled || 0); x.validVotes += Number(s.validVotes || 0); x.notaVotes += Number(s.notaVotes || 0); statMap.set(s.electionId, x); }
  const partyMap = new Map<string, any>(); const stateMap = new Map<string, any>();
  const electionData = elections.map(e => { const st = statMap.get(e.id) || { electors: 0, votesPolled: 0, validVotes: 0, notaVotes: 0 }; const er = rows.filter(r => r.electionId === e.id); const seats = er.filter(r => r.isWinner).length; const result = { election: e, seats, electors: st.electors, votesPolled: st.votesPolled, validVotes: st.validVotes, notaVotes: st.notaVotes, turnoutPercentage: st.electors ? st.votesPolled / st.electors * 100 : 0 }; for (const r of er) { if (r.party) { const key = `${e.id}:${r.party.id}`; const p = partyMap.get(key) || { id: r.party.id, name: r.party.name, abbreviation: r.party.abbreviation, electionId: e.id, votes: 0, seatsWon: 0 }; p.votes += Number(r.votes || 0); if (r.isWinner) p.seatsWon++; partyMap.set(key, p); } const state = r.constituencyVersion.constituency.state; if (state) { const key = `${e.id}:${state.id}`; const s = stateMap.get(key) || { id: state.id, name: state.name, electionId: e.id, votes: 0, seats: 0 }; s.votes += Number(r.votes || 0); if (r.isWinner) s.seats++; stateMap.set(key, s); } } return result; });
  const partyGroups = new Map<string, any>(); for (const p of partyMap.values()) { const x = partyGroups.get(p.id) || { id: p.id, name: p.name, abbreviation: p.abbreviation, elections: [] }; const valid = statMap.get(p.electionId)?.validVotes || 0; x.elections.push({ year: elections.find(e => e.id === p.electionId)?.year, electionId: p.electionId, seatsWon: p.seatsWon, votes: p.votes, voteShare: valid ? p.votes / valid * 100 : 0 }); partyGroups.set(p.id, x); }
  const latestId = elections[elections.length - 1].id; const states = [...stateMap.values()].filter(s => s.electionId === latestId).sort((a,b) => b.seats-a.seats || b.votes-a.votes);
  return { elections: electionData, parties: [...partyGroups.values()].sort((a,b) => (b.elections.at(-1)?.seatsWon||0) - (a.elections.at(-1)?.seatsWon||0)), states };
}

export async function compareElections(fromId: string, toId: string) {
  const [from, to] = await Promise.all([prisma.election.findFirst({ where: { id: fromId, sourceStatus: 'PUBLISHED' } }), prisma.election.findFirst({ where: { id: toId, sourceStatus: 'PUBLISHED' } })]);
  if (!from || !to) return null;
  const rows = await prisma.candidateResult.findMany({ where: { electionId: { in: [fromId, toId] } }, select: { electionId: true, partyId: true, votes: true, isWinner: true, candidate: { select: { id: true, name: true } }, party: { select: { id: true, name: true, abbreviation: true } }, constituencyVersion: { select: { constituency: { select: { id: true, name: true, state: { select: { name: true } } } } } } } });
  const stats = new Map<string, number>(); for (const r of rows) { const key = `${r.electionId}:${r.partyId||'NONE'}`; stats.set(key, (stats.get(key)||0)+Number(r.votes||0)); }
  const parties = new Map<string, any>(); for (const r of rows) if (r.party) { const p = parties.get(r.party.id)||{ id:r.party.id,name:r.party.name,abbreviation:r.party.abbreviation,from:{seatsWon:0,votes:0},to:{seatsWon:0,votes:0} }; const side=r.electionId===fromId?'from':'to'; p[side].votes += Number(r.votes||0); if(r.isWinner)p[side].seatsWon++; parties.set(r.party.id,p); }
  const fromW = new Map<string, any>(), toW = new Map<string, any>(); for(const r of rows) if(r.isWinner){const x={constituency:r.constituencyVersion.constituency,candidate:r.candidate,party:r.party}; (r.electionId===fromId?fromW:toW).set(r.constituencyVersion.constituency.id,x);}
  const winnerChanges:any[]=[]; let unchanged=0; for(const id of new Set([...fromW.keys(),...toW.keys()])){const a=fromW.get(id),b=toW.get(id);if(a&&b&&a.party?.id===b.party?.id)unchanged++;else if(a||b)winnerChanges.push({constituency:(b||a).constituency,from:a||null,to:b||null});}
  const partyRows=[...parties.values()].map(p=>({...p,seatDelta:p.to.seatsWon-p.from.seatsWon,voteDelta:p.to.votes-p.from.votes})).sort((a,b)=>Math.abs(b.seatDelta)-Math.abs(a.seatDelta)||b.to.seatsWon-a.to.seatsWon);
  const fromValid=await prisma.constituencyStatistic.aggregate({where:{electionId:fromId},_sum:{validVotes:true}}); const toValid=await prisma.constituencyStatistic.aggregate({where:{electionId:toId},_sum:{validVotes:true}}); for(const p of partyRows){const a=fromValid._sum.validVotes||0,b=toValid._sum.validVotes||0;p.voteShareDelta=(b?p.to.votes/b*100:0)-(a?p.from.votes/a*100:0);}
  return { from, to, summary:{winnerChanges:winnerChanges.length,unchangedWinners:unchanged}, parties:partyRows, winnerChanges:winnerChanges.slice(0,100) };
}