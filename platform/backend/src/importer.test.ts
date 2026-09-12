import assert from 'node:assert/strict';
import test from 'node:test';
import { validateRecord, normalizeRecord } from './importer.js';

test('valid election result row passes validation', () => {
  const row = { electionId: '00000000-0000-4000-8000-000000000001', constituencyVersionId: '00000000-0000-4000-8000-000000000002', candidateId: '00000000-0000-4000-8000-000000000003', partyId: '00000000-0000-4000-8000-000000000004', votes: '100', voteShare: '50.25', position: '1', isWinner: 'true' };
  assert.deepEqual(validateRecord(row), []);
  assert.deepEqual(normalizeRecord(row), { electionId: row.electionId, constituencyVersionId: row.constituencyVersionId, candidateId: row.candidateId, partyId: row.partyId, votes: 100, voteShare: 50.25, position: 1, isWinner: true });
});

test('invalid votes and winner values are rejected', () => {
  const errors = validateRecord({ electionId: 'bad', constituencyVersionId: 'bad', candidateId: 'bad', votes: '-1', position: '0', isWinner: 'maybe' });
  assert.ok(errors.some((e) => e.includes('votes')));
  assert.ok(errors.some((e) => e.includes('position')));
  assert.ok(errors.some((e) => e.includes('isWinner')));
});
