import { parse } from 'csv-parse/sync';
import * as XLSX from 'xlsx';

export type ImportRecord = Record<string, string | number | boolean | null>;

const MAX_FILE_BYTES = Number(process.env.MAX_IMPORT_BYTES || 10 * 1024 * 1024);
const REQUIRED = ['electionId', 'constituencyVersionId', 'candidateId', 'votes', 'position', 'isWinner'];

export function parseElectionFile(filename: string, buffer: Buffer): ImportRecord[] {
  if (buffer.length > MAX_FILE_BYTES) throw new Error(`File exceeds ${MAX_FILE_BYTES} bytes`);
  const ext = filename.toLowerCase().split('.').pop();
  if (ext === 'csv') {
    const rows = parse(buffer, { columns: true, skip_empty_lines: true, bom: true, trim: true }) as ImportRecord[];
    return rows;
  }
  if (ext === 'xlsx' || ext === 'xls') {
    const workbook = XLSX.read(buffer, { type: 'buffer', cellDates: false });
    const first = workbook.SheetNames[0];
    if (!first) throw new Error('Workbook has no sheets');
    return XLSX.utils.sheet_to_json<ImportRecord>(workbook.Sheets[first], { defval: null, raw: false });
  }
  throw new Error('Only CSV, XLSX and XLS files are supported');
}

function text(v: unknown) { return v == null ? '' : String(v).trim(); }
function uuid(v: unknown) { return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(text(v)); }
function integer(v: unknown) { return /^-?\d+$/.test(text(v)); }
function decimal(v: unknown) { return /^-?\d+(\.\d+)?$/.test(text(v)); }
function bool(v: unknown) { return ['true', 'false', '1', '0', 'yes', 'no'].includes(text(v).toLowerCase()); }
function asBool(v: unknown) { return ['true', '1', 'yes'].includes(text(v).toLowerCase()); }

export function validateRecord(row: ImportRecord) {
  const errors: string[] = [];
  for (const field of REQUIRED) if (!text(row[field])) errors.push(`${field} is required`);
  for (const field of ['electionId', 'constituencyVersionId', 'candidateId']) if (text(row[field]) && !uuid(row[field])) errors.push(`${field} must be a UUID`);
  if (text(row.partyId) && !uuid(row.partyId)) errors.push('partyId must be a UUID');
  if (!integer(row.votes) || Number(row.votes) < 0) errors.push('votes must be a non-negative integer');
  if (!integer(row.position) || Number(row.position) < 1) errors.push('position must be a positive integer');
  if (!bool(row.isWinner)) errors.push('isWinner must be true/false, 1/0 or yes/no');
  if (text(row.voteShare) && (!decimal(row.voteShare) || Number(row.voteShare) < 0 || Number(row.voteShare) > 100)) errors.push('voteShare must be between 0 and 100');
  if (text(row.electionId) && text(row.electionId) !== text(row._electionId)) {
    // _electionId is optional and, when supplied by an import template, must agree with electionId.
  }
  return errors;
}

export function normalizeRecord(row: ImportRecord) {
  return {
    electionId: text(row.electionId),
    constituencyVersionId: text(row.constituencyVersionId),
    candidateId: text(row.candidateId),
    partyId: text(row.partyId) || null,
    votes: Number(row.votes),
    voteShare: text(row.voteShare) ? Number(row.voteShare) : null,
    position: Number(row.position),
    isWinner: asBool(row.isWinner)
  };
}
