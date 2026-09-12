export type ImportBatchStatus = 'UPLOADED' | 'VALIDATING' | 'VALIDATED' | 'REVIEWED' | 'REJECTED' | 'PUBLISHED';

const transitions: Record<ImportBatchStatus, ImportBatchStatus[]> = {
  UPLOADED: ['VALIDATING', 'REJECTED'],
  VALIDATING: ['VALIDATED', 'REJECTED'],
  VALIDATED: ['REVIEWED', 'REJECTED'],
  REVIEWED: ['PUBLISHED', 'REJECTED'],
  REJECTED: ['UPLOADED'],
  PUBLISHED: [],
};

export function assertTransition(from: ImportBatchStatus, to: ImportBatchStatus) {
  if (!transitions[from].includes(to)) throw new Error(`Invalid import transition: ${from} -> ${to}`);
}

export function summariseValidation(rows: Array<{ valid: boolean }>) {
  const totalRows = rows.length;
  const validRows = rows.filter(r => r.valid).length;
  return { totalRows, validRows, errorRows: totalRows - validRows };
}
