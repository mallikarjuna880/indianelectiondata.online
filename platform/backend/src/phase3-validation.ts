import { randomUUID } from 'node:crypto';

export type ImportPayload = {
  election_id: string;
  constituency_version_id: string;
  candidate_id: string;
  party_id?: string | null;
  votes: number;
  vote_share?: number | null;
  position: number;
  is_winner: boolean;
};

export type ValidationError = { code: string; message: string };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function parseBoolean(value: unknown): boolean | null {
  if (value === true || value === 'true' || value === '1' || value === 1) return true;
  if (value === false || value === 'false' || value === '0' || value === 0) return false;
  return null;
}

export function validateImportRow(raw: Record<string, unknown>): { payload?: ImportPayload; errors: ValidationError[] } {
  const errors: ValidationError[] = [];
  const required = ['election_id', 'constituency_version_id', 'candidate_id', 'votes', 'position', 'is_winner'];
  for (const key of required) if (raw[key] === undefined || raw[key] === '') errors.push({ code: 'REQUIRED', message: `${key} is required` });

  const ids = ['election_id', 'constituency_version_id', 'candidate_id', 'party_id'];
  for (const key of ids) if (raw[key] !== undefined && raw[key] !== '' && raw[key] !== null && !UUID.test(String(raw[key]))) errors.push({ code: 'UUID', message: `${key} must be a UUID` });

  const votes = Number(raw.votes);
  const position = Number(raw.position);
  const voteShare = raw.vote_share === undefined || raw.vote_share === '' || raw.vote_share === null ? null : Number(raw.vote_share);
  const winner = parseBoolean(raw.is_winner);
  if (!Number.isInteger(votes) || votes < 0) errors.push({ code: 'VOTES', message: 'votes must be a non-negative integer' });
  if (!Number.isInteger(position) || position < 1) errors.push({ code: 'POSITION', message: 'position must be a positive integer' });
  if (voteShare !== null && (!Number.isFinite(voteShare) || voteShare < 0 || voteShare > 100)) errors.push({ code: 'VOTE_SHARE', message: 'vote_share must be between 0 and 100' });
  if (winner === null) errors.push({ code: 'WINNER', message: 'is_winner must be true/false' });
  if (winner === true && position !== 1) errors.push({ code: 'WINNER_POSITION', message: 'winner must have position 1' });

  if (errors.length) return { errors };
  return { errors, payload: {
    election_id: String(raw.election_id), constituency_version_id: String(raw.constituency_version_id), candidate_id: String(raw.candidate_id),
    party_id: raw.party_id ? String(raw.party_id) : null, votes, vote_share: voteShare, position, is_winner: winner as boolean,
  }};
}

export function makeRequestId() { return randomUUID(); }
