function esc(v) {
  if (v === null || v === undefined) return '';
  const s = String(v);
  return s.includes(',') || s.includes('"') || s.includes('\n') ? `"${s.replace(/"/g, '""')}"` : s;
}

export function buildFullJsonExport(allKeys) {
  return JSON.stringify({ schemaVersion: 2, exportedAt: new Date().toISOString(), data: allKeys }, null, 2);
}

export function buildAccountCsv(accountKey, transactions) {
  const rows = (transactions || [])
    .filter(t => t.accountKey === accountKey && !t.deleted)
    .sort((a, b) => a.timestamp - b.timestamp);
  let balance = 0;
  const lines = ['Date,Description,Category,Amount,Balance After,Payment Method'];
  for (const t of rows) {
    balance += t.amountCents;
    lines.push([
      new Date(t.timestamp).toLocaleDateString(),
      esc(t.description),
      esc(t.category),
      (t.amountCents / 100).toFixed(2),
      (balance / 100).toFixed(2),
      esc(t.paymentMethod),
    ].join(','));
  }
  return lines.join('\n');
}

export function buildMassageIncomeCsv(massageIncome) {
  const rows = (massageIncome || []).filter(r => !r.deleted).sort((a, b) => a.date - b.date);
  const lines = ['Date,Amount,Payment Method,Destination,Notes'];
  for (const r of rows) {
    lines.push([
      new Date(r.date).toLocaleDateString(),
      (r.amountCents / 100).toFixed(2),
      esc(r.paymentMethod),
      esc(r.destinationAccount),
      esc(r.notes),
    ].join(','));
  }
  return lines.join('\n');
}

export function buildMassageExpenseCsv(massageExpenses) {
  const rows = (massageExpenses || []).filter(r => !r.deleted).sort((a, b) => a.date - b.date);
  const lines = ['Date,Amount,Category,Description'];
  for (const r of rows) {
    lines.push([
      new Date(r.date).toLocaleDateString(),
      (r.amountCents / 100).toFixed(2),
      esc(r.category),
      esc(r.description),
    ].join(','));
  }
  return lines.join('\n');
}

export function buildCleaningIncomeCsv(cleaningIncome) {
  const rows = (cleaningIncome || []).filter(r => !r.deleted).sort((a, b) => a.date - b.date);
  const lines = ['Date,Amount,Client,Payment Method,Notes'];
  for (const r of rows) {
    lines.push([
      new Date(r.date).toLocaleDateString(),
      (r.amountCents / 100).toFixed(2),
      esc(r.clientName || r.client),
      esc(r.paymentMethod),
      esc(r.notes),
    ].join(','));
  }
  return lines.join('\n');
}

export function buildCleaningExpenseCsv(cleaningExpenses) {
  const rows = (cleaningExpenses || []).filter(r => !r.deleted).sort((a, b) => a.date - b.date);
  const lines = ['Date,Amount,Category,Description,Tax Deductible,Receipt Note'];
  for (const r of rows) {
    lines.push([
      new Date(r.date).toLocaleDateString(),
      (r.amountCents / 100).toFixed(2),
      esc(r.category),
      esc(r.description),
      r.taxDeductible ? 'Yes' : 'No',
      esc(r.receiptNote),
    ].join(','));
  }
  return lines.join('\n');
}

export function buildCleaningMileageCsv(cleaningMileage) {
  const rows = (cleaningMileage || []).filter(r => !r.deleted).sort((a, b) => a.date - b.date);
  const lines = ['Date,Miles,Purpose,IRS Rate,Deduction Amount'];
  for (const r of rows) {
    lines.push([
      new Date(r.date).toLocaleDateString(),
      (r.miles || 0).toFixed(1),
      esc(r.purpose),
      ((r.irsRateCents || 0) / 100).toFixed(2),
      ((r.deductionCents || 0) / 100).toFixed(2),
    ].join(','));
  }
  return lines.join('\n');
}

export function validateImportJson(parsed) {
  if (!parsed || typeof parsed !== 'object') return { valid: false, reason: 'File is not a valid JSON object.' };
  if (typeof parsed.schemaVersion !== 'number') return { valid: false, reason: 'Missing or invalid schemaVersion.' };
  if (!parsed.data || typeof parsed.data !== 'object') return { valid: false, reason: 'Missing data object.' };
  return { valid: true, reason: '' };
}
