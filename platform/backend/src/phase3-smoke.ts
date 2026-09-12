import { randomUUID } from 'node:crypto';
import { prisma } from './db.js';

const baseUrl = process.env.SMOKE_BASE_URL || 'http://127.0.0.1:4000';
const email = process.env.ADMIN_EMAIL || 'admin@ci.example';
const password = process.env.ADMIN_PASSWORD || 'CI-Admin-Password-123!';

async function json<T>(res: Response): Promise<T> {
  const text = await res.text();
  if (!res.ok) throw new Error(`${res.status} ${res.statusText}: ${text}`);
  return JSON.parse(text) as T;
}

function cookieFrom(response: Response) {
  const setCookie = response.headers.get('set-cookie');
  if (!setCookie) throw new Error('Login did not return a session cookie');
  return setCookie.split(';', 1)[0];
}

const suffix = randomUUID().slice(0, 8);
const state = await prisma.state.create({ data: { name: `CI Test State ${suffix}`, abbreviation: `C${suffix.slice(0, 2)}`, stateCode: `CI${suffix.slice(0, 2)}` } });
const election = await prisma.election.create({ data: { name: `CI Test Election ${suffix}`, electionType: 'ASSEMBLY', year: 2099 } });
const constituency = await prisma.constituency.create({ data: { stateId: state.id, name: `CI Test Constituency ${suffix}` } });
const version = await prisma.constituencyVersion.create({ data: { constituencyId: constituency.id, electionId: election.id, name: constituency.name, constituencyNumber: 1 } });
const party = await prisma.party.create({ data: { name: `CI Test Party ${suffix}`, abbreviation: `CT${suffix.slice(0, 2)}` } });
const candidate = await prisma.candidate.create({ data: { name: `CI Test Candidate ${suffix}` } });

try {
  const loginResponse = await fetch(`${baseUrl}/api/v1/admin/login`, {
    method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ email, password })
  });
  const cookie = cookieFrom(loginResponse);
  await json(await fetch(`${baseUrl}/api/v1/admin/me`, { headers: { cookie } }));

  const csv = [
    'electionId,constituencyVersionId,candidateId,partyId,votes,voteShare,position,isWinner',
    `${election.id},${version.id},${candidate.id},${party.id},12345,100,1,true`
  ].join('\n');
  const form = new FormData();
  form.append('file', new Blob([csv], { type: 'text/csv' }), 'ci-test-results.csv');

  const upload = await json<{ id: string }>(await fetch(`${baseUrl}/api/v1/admin/imports`, { method: 'POST', headers: { cookie }, body: form }));
  const batchId = upload.id;

  const validated = await json<{ status: string; validRows: number; errorRows: number }>(await fetch(`${baseUrl}/api/v1/admin/imports/${batchId}/validate`, { method: 'POST', headers: { cookie } }));
  if (validated.status !== 'VALIDATED' || validated.validRows !== 1 || validated.errorRows !== 0) throw new Error(`Validation failed: ${JSON.stringify(validated)}`);

  const reviewed = await json<{ status: string }>(await fetch(`${baseUrl}/api/v1/admin/imports/${batchId}/review`, {
    method: 'POST', headers: { cookie, 'content-type': 'application/json' }, body: JSON.stringify({ decision: 'APPROVE', comment: 'CI smoke test' })
  }));
  if (reviewed.status !== 'APPROVED') throw new Error(`Review failed: ${JSON.stringify(reviewed)}`);

  const published = await json<{ status: string; electionId: string }>(await fetch(`${baseUrl}/api/v1/admin/imports/${batchId}/publish`, {
    method: 'POST', headers: { cookie, 'content-type': 'application/json' }, body: JSON.stringify({ electionId: election.id, sourceName: 'CI smoke test source', organization: 'IndianElectionData CI', sourceUrl: 'https://example.invalid/ci-test' })
  }));
  if (published.status !== 'PUBLISHED') throw new Error(`Publish failed: ${JSON.stringify(published)}`);

  const publicElections = await json<{ data: Array<{ id: string; sourceStatus: string }> }>(await fetch(`${baseUrl}/api/v1/elections`));
  if (!publicElections.data.some(item => item.id === election.id && item.sourceStatus === 'PUBLISHED')) throw new Error('Published election was not visible through the public API');

  const result = await prisma.candidateResult.findFirst({ where: { electionId: election.id, candidateId: candidate.id } });
  if (!result || result.votes !== 12345 || !result.isWinner) throw new Error('Published CandidateResult was not persisted correctly');

  console.log('PHASE 3 E2E PASSED: login -> upload -> validate -> approve -> publish -> public API verified');
} finally {
  await prisma.resultSource.deleteMany({ where: { result: { electionId: election.id } } });
  await prisma.candidateResult.deleteMany({ where: { electionId: election.id } });
  await prisma.importBatch.deleteMany({ where: { electionId: election.id } });
  await prisma.dataSource.deleteMany({ where: { name: { contains: 'CI smoke test source' } } });
  await prisma.constituencyStatistic.deleteMany({ where: { electionId: election.id } });
  await prisma.constituencyVersion.delete({ where: { id: version.id } });
  await prisma.election.delete({ where: { id: election.id } });
  await prisma.constituency.delete({ where: { id: constituency.id } });
  await prisma.state.delete({ where: { id: state.id } });
  await prisma.candidate.delete({ where: { id: candidate.id } });
  await prisma.party.delete({ where: { id: party.id } });
  await prisma.$disconnect();
}
