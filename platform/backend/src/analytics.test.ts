import assert from 'node:assert/strict';
import { test, after } from 'node:test';
import { prisma } from './db.js';
import { getConstituencyAnalytics, getElectionMargins, getElectionPartyPerformance, getElectionStatePerformance, getElectionSummary, getElectionTurnout } from './analytics/election-analytics.js';

let electionId: string;
let constituencyId: string;
let versionId: string;
let stateId: string;
let partyId: string;
let candidateAId: string;
let candidateBId: string;

 test('analytics service calculates published election metrics', async () => {
  const suffix = Date.now().toString();
  const state = await prisma.state.create({ data: { name: `Analytics State ${suffix}`, abbreviation: `AS${suffix.slice(-2)}`, stateCode: `AN${suffix.slice(-2)}` } });
  stateId = state.id;
  const election = await prisma.election.create({ data: { name: `Analytics Election ${suffix}`, electionType: 'ASSEMBLY', year: 2098, sourceStatus: 'PUBLISHED' } });
  electionId = election.id;
  const constituency = await prisma.constituency.create({ data: { stateId: state.id, name: `Analytics Constituency ${suffix}` } });
  constituencyId = constituency.id;
  const version = await prisma.constituencyVersion.create({ data: { constituencyId: constituency.id, electionId: election.id, name: constituency.name, constituencyNumber: 1 } });
  versionId = version.id;
  const party = await prisma.party.create({ data: { name: `Analytics Party ${suffix}`, abbreviation: `AP${suffix.slice(-2)}` } });
  partyId = party.id;
  const candidateA = await prisma.candidate.create({ data: { name: `Analytics Candidate A ${suffix}` } });
  const candidateB = await prisma.candidate.create({ data: { name: `Analytics Candidate B ${suffix}` } });
  candidateAId = candidateA.id;
  candidateBId = candidateB.id;

  await prisma.candidateResult.createMany({ data: [
    { electionId: election.id, constituencyVersionId: version.id, candidateId: candidateA.id, partyId: party.id, votes: 600, voteShare: 60, position: 1, isWinner: true },
    { electionId: election.id, constituencyVersionId: version.id, candidateId: candidateB.id, partyId: null, votes: 400, voteShare: 40, position: 2, isWinner: false }
  ] });
  await prisma.constituencyStatistic.create({ data: { electionId: election.id, constituencyVersionId: version.id, electors: 1250, votesPolled: 1000, validVotes: 980, notaVotes: 20, turnoutPercentage: 80 } });

  const summary = await getElectionSummary(election.id);
  assert.deepEqual(summary, { electionId: election.id, seatsContested: 1, seatsWithResults: 1, candidates: 2, parties: 1, totalVotes: 1000, winningResults: 1, turnout: 80, notaVotes: 20 });

  const parties = await getElectionPartyPerformance(election.id);
  assert.equal(parties?.[0]?.votes, 600);
  assert.equal(parties?.[0]?.voteShare, 60);
  assert.equal(parties?.[0]?.seatsWon, 1);

  const states = await getElectionStatePerformance(election.id);
  assert.equal(states?.[0]?.votes, 1000);
  assert.equal(states?.[0]?.voteShare, 100);
  assert.equal(states?.[0]?.seatsWon, 1);

  const margins = await getElectionMargins(election.id);
  assert.equal(margins?.[0]?.margin, 200);
  assert.equal(margins?.[0]?.winner?.candidateId, candidateA.id);
  assert.equal(margins?.[0]?.runnerUp?.candidateId, candidateB.id);

  const turnout = await getElectionTurnout(election.id);
  assert.equal(turnout?.electors, 1250);
  assert.equal(turnout?.votesPolled, 1000);
  assert.equal(turnout?.validVotes, 980);
  assert.equal(turnout?.notaVotes, 20);
  assert.equal(turnout?.turnoutPercentage, 80);

  const constituencyAnalytics = await getConstituencyAnalytics(constituency.id, election.id);
  assert.equal(constituencyAnalytics?.winner?.candidateId, candidateA.id);
  assert.equal(constituencyAnalytics?.runnerUp?.candidateId, candidateB.id);
  assert.equal(constituencyAnalytics?.margin, 200);
});

test('analytics service hides unpublished elections', async () => {
  const election = await prisma.election.create({ data: { name: `Hidden Analytics Election ${Date.now()}`, electionType: 'ASSEMBLY', year: 2097, sourceStatus: 'DRAFT' } });
  try {
    assert.equal(await getElectionSummary(election.id), null);
    assert.equal(await getElectionPartyPerformance(election.id), null);
    assert.equal(await getElectionStatePerformance(election.id), null);
    assert.equal(await getElectionMargins(election.id), null);
    assert.equal(await getElectionTurnout(election.id), null);
  } finally {
    await prisma.election.delete({ where: { id: election.id } });
  }
});

after(async () => {
  if (electionId) {
    await prisma.constituencyStatistic.deleteMany({ where: { electionId } });
    await prisma.candidateResult.deleteMany({ where: { electionId } });
    await prisma.constituencyVersion.deleteMany({ where: { electionId } });
    await prisma.importBatch.deleteMany({ where: { electionId } });
    await prisma.election.delete({ where: { id: electionId } });
  }
  if (constituencyId) await prisma.constituency.delete({ where: { id: constituencyId } });
  if (stateId) await prisma.state.delete({ where: { id: stateId } });
  if (candidateAId) await prisma.candidate.delete({ where: { id: candidateAId } });
  if (candidateBId) await prisma.candidate.delete({ where: { id: candidateBId } });
  if (partyId) await prisma.party.delete({ where: { id: partyId } });
  await prisma.$disconnect();
});
