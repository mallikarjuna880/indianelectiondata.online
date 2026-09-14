import assert from 'node:assert/strict';
import Fastify from 'fastify';
import { prisma } from './db.js';
import { registerPartyAnalyticsApi } from './analytics/party-analytics-api.js';

const app = Fastify();
await registerPartyAnalyticsApi(app);

const state = await prisma.state.create({ data: { name: `4C API Test State ${Date.now()}`, abbreviation: '4A' } });
const election = await prisma.election.create({ data: { name: '4C API Test Election', electionType: 'ASSEMBLY', year: 2098, sourceStatus: 'PUBLISHED' } });
const constituency = await prisma.constituency.create({ data: { stateId: state.id, name: '4C API Test Constituency' } });
const version = await prisma.constituencyVersion.create({ data: { constituencyId: constituency.id, electionId: election.id, name: '4C API Test Constituency' } });
const partyA = await prisma.party.create({ data: { name: '4C API Alpha Party', abbreviation: 'AAP' } });
const partyB = await prisma.party.create({ data: { name: '4C API Beta Party', abbreviation: 'ABP' } });
const candidateA = await prisma.candidate.create({ data: { name: '4C API Alpha Candidate' } });
const candidateB = await prisma.candidate.create({ data: { name: '4C API Beta Candidate' } });

try {
  await prisma.candidateResult.createMany({ data: [
    { electionId: election.id, constituencyVersionId: version.id, candidateId: candidateA.id, partyId: partyA.id, votes: 600, voteShare: 60, position: 1, isWinner: true },
    { electionId: election.id, constituencyVersionId: version.id, candidateId: candidateB.id, partyId: partyB.id, votes: 400, voteShare: 40, position: 2, isWinner: false }
  ] });

  const invalidMetric = await app.inject({ method: 'GET', url: `/api/v1/analytics/elections/${election.id}/party-rankings?metric=invalid` });
  assert.equal(invalidMetric.statusCode, 400);
  assert.equal(invalidMetric.json().error, 'INVALID_RANKING_METRIC');

  const missingElection = await app.inject({ method: 'GET', url: '/api/v1/analytics/elections/nonexistent-election/party-rankings' });
  assert.equal(missingElection.statusCode, 404);
  assert.equal(missingElection.json().error, 'ELECTION_NOT_FOUND');

  const missingComparisonElection = await app.inject({ method: 'GET', url: `/api/v1/analytics/elections/${election.id}/party-compare?compareElectionId=nonexistent-comparison` });
  assert.equal(missingComparisonElection.statusCode, 404);
  assert.equal(missingComparisonElection.json().error, 'COMPARE_ELECTION_NOT_FOUND');

  const missingParty = await app.inject({ method: 'GET', url: '/api/v1/analytics/parties/nonexistent-party/performance' });
  assert.equal(missingParty.statusCode, 404);
  assert.equal(missingParty.json().error, 'PARTY_NOT_FOUND');

  const missingStateParty = await app.inject({ method: 'GET', url: `/api/v1/analytics/parties/nonexistent-party/elections/${election.id}/states` });
  assert.equal(missingStateParty.statusCode, 404);
  assert.equal(missingStateParty.json().error, 'PARTY_OR_ELECTION_NOT_FOUND');

  const emptySelection = await app.inject({ method: 'GET', url: `/api/v1/analytics/elections/${election.id}/party-compare?partyIds=` });
  assert.equal(emptySelection.statusCode, 200);
  assert.equal(emptySelection.json().data.length, 2);

  const selectedParty = await app.inject({ method: 'GET', url: `/api/v1/analytics/elections/${election.id}/party-compare?partyIds=${partyA.id}` });
  assert.equal(selectedParty.statusCode, 200);
  assert.equal(selectedParty.json().data.length, 1);
  assert.equal(selectedParty.json().data[0].partyId, partyA.id);

  const tooManyParties = Array.from({ length: 11 }, (_, index) => `party-${index}`).join(',');
  const excessiveSelection = await app.inject({ method: 'GET', url: `/api/v1/analytics/elections/${election.id}/party-compare?partyIds=${tooManyParties}` });
  assert.equal(excessiveSelection.statusCode, 400);
  assert.equal(excessiveSelection.json().error, 'TOO_MANY_PARTIES');
  assert.equal(excessiveSelection.json().max, 10);

  console.log('4C.3-A.5 PARTY ANALYTICS HTTP VALIDATION: PASS');
} finally {
  await app.close();
  await prisma.candidateResult.deleteMany({ where: { electionId: election.id } });
  await prisma.constituencyVersion.delete({ where: { id: version.id } });
  await prisma.constituency.delete({ where: { id: constituency.id } });
  await prisma.election.delete({ where: { id: election.id } });
  await prisma.candidate.deleteMany({ where: { id: { in: [candidateA.id, candidateB.id] } } });
  await prisma.party.deleteMany({ where: { id: { in: [partyA.id, partyB.id] } } });
  await prisma.state.delete({ where: { id: state.id } });
  await prisma.$disconnect();
}
