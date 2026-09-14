import assert from 'node:assert/strict';
import { prisma } from './db.js';
import { getPartyComparison, getPartyElectionPerformance, getPartyPerformanceMetrics, getPartyStatePerformance } from './analytics/party-analytics.js';
import { rankParties } from './analytics/party-analytics-api.js';

const state = await prisma.state.create({ data: { name: `4C Test State ${Date.now()}`, abbreviation: '4C' } });
const election = await prisma.election.create({ data: { name: '4C Test Election', electionType: 'ASSEMBLY', year: 2099, sourceStatus: 'PUBLISHED' } });
const constituency = await prisma.constituency.create({ data: { stateId: state.id, name: '4C Test Constituency' } });
const version = await prisma.constituencyVersion.create({ data: { constituencyId: constituency.id, electionId: election.id, name: '4C Test Constituency' } });
const partyA = await prisma.party.create({ data: { name: '4C Alpha Party', abbreviation: 'ALP' } });
const partyB = await prisma.party.create({ data: { name: '4C Beta Party', abbreviation: 'BET' } });
const candidateA = await prisma.candidate.create({ data: { name: '4C Alpha Candidate' } });
const candidateB = await prisma.candidate.create({ data: { name: '4C Beta Candidate' } });

try {
  await prisma.candidateResult.createMany({ data: [
    { electionId: election.id, constituencyVersionId: version.id, candidateId: candidateA.id, partyId: partyA.id, votes: 600, voteShare: 60, position: 1, isWinner: true },
    { electionId: election.id, constituencyVersionId: version.id, candidateId: candidateB.id, partyId: partyB.id, votes: 400, voteShare: 40, position: 2, isWinner: false }
  ] });

  const performance = await getPartyElectionPerformance(partyA.id);
  assert.equal(performance?.length, 1);
  assert.equal(performance?.[0].seatsContested, 1);
  assert.equal(performance?.[0].seatsWon, 1);
  assert.equal(performance?.[0].candidates, 1);
  assert.equal(performance?.[0].votes, 600);
  assert.equal(performance?.[0].voteShare, 60);
  assert.equal(performance?.[0].winRate, 100);
  assert.equal(performance?.[0].averageVotesPerSeat, 600);
  assert.equal(performance?.[0].firstPlaceFinishes, 1);
  assert.equal(performance?.[0].secondPlaceFinishes, 0);
  assert.equal(performance?.[0].thirdPlaceFinishes, 0);
  assert.equal(performance?.[0].averageWinningMargin, 200);
  assert.equal(performance?.[0].totalWinningMargin, 200);
  assert.equal(performance?.[0].closeLosses, 0);
  assert.equal(performance?.[0].strongholdWins, 0);

  const metrics = await getPartyPerformanceMetrics(partyA.id, election.id);
  assert.equal(metrics?.seatsContested, 1);
  assert.equal(metrics?.seatsWon, 1);
  assert.equal(metrics?.seatsLost, 0);
  assert.equal(metrics?.votes, 600);
  assert.equal(metrics?.voteShare, 60);
  assert.equal(metrics?.winRate, 100);
  assert.equal(metrics?.averageWinningMargin, 200);
  assert.equal(metrics?.totalWinningMargin, 200);

  const states = await getPartyStatePerformance(partyA.id, election.id);
  assert.equal(states?.length, 1);
  assert.equal(states?.[0].stateName, state.name);
  assert.equal(states?.[0].seatsContested, 1);
  assert.equal(states?.[0].seatsWon, 1);
  assert.equal(states?.[0].votes, 600);
  assert.equal(states?.[0].voteShare, 100);

  const comparison = await getPartyComparison(election.id);
  assert.equal(comparison?.length, 2);
  assert.equal(comparison?.[0].partyId, partyA.id);
  assert.equal(comparison?.[0].seatsWon, 1);
  assert.equal(comparison?.[0].votes, 600);
  assert.equal(comparison?.[0].voteShare, 60);
  assert.equal(comparison?.[1].partyId, partyB.id);
  assert.equal(comparison?.[1].votes, 400);

  const seatRanking = rankParties(comparison, 'seats');
  assert.equal(seatRanking?.[0].partyId, partyA.id);
  assert.equal(seatRanking?.[0].rank, 1);
  assert.equal(seatRanking?.[1].partyId, partyB.id);
  assert.equal(seatRanking?.[1].rank, 2);
  const voteRanking = rankParties(comparison, 'votes');
  assert.equal(voteRanking?.[0].partyId, partyA.id);
  assert.equal(voteRanking?.[0].metricValue, 600);
  const shareRanking = rankParties(comparison, 'voteShare');
  assert.equal(shareRanking?.[0].metricValue, 60);
  const winRateRanking = rankParties(comparison, 'winRate');
  assert.equal(winRateRanking?.[0].metricValue, 100);

  await prisma.election.update({ where: { id: election.id }, data: { sourceStatus: 'DRAFT' } });
  assert.equal(await getPartyPerformanceMetrics(partyA.id, election.id), null);
  assert.equal(await getPartyStatePerformance(partyA.id, election.id), null);
  assert.equal(await getPartyComparison(election.id), null);

  console.log('4C.3 PARTY COMPARISON & RANKINGS SMOKE: PASS');
} finally {
  await prisma.candidateResult.deleteMany({ where: { electionId: election.id } });
  await prisma.constituencyVersion.delete({ where: { id: version.id } });
  await prisma.constituency.delete({ where: { id: constituency.id } });
  await prisma.election.delete({ where: { id: election.id } });
  await prisma.candidate.deleteMany({ where: { id: { in: [candidateA.id, candidateB.id] } } });
  await prisma.party.deleteMany({ where: { id: { in: [partyA.id, partyB.id] } } });
  await prisma.state.delete({ where: { id: state.id } });
  await prisma.$disconnect();
}
