export const RECONCILIATION_STATUS = {
  matched: 'matched',
  adjusted: 'adjusted',
  variance: 'variance',
};

export function localDateKey(value = Date.now()) {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return localDateKey(Date.now());
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function cleanCents(value) {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? Math.trunc(numeric) : 0;
}

export function reconciliationStatusFor({ differenceCents = 0, adjustedBalance = false } = {}) {
  const diff = cleanCents(differenceCents);
  if (diff === 0) return RECONCILIATION_STATUS.matched;
  return adjustedBalance ? RECONCILIATION_STATUS.adjusted : RECONCILIATION_STATUS.variance;
}

export function normalizeReconciliationRecord(input = {}, existing = null) {
  const bankBalanceCents = cleanCents(input.bankBalanceCents ?? existing?.bankBalanceCents);
  const novaBalanceCents = cleanCents(input.novaBalanceCents ?? existing?.novaBalanceCents);
  const differenceCents = cleanCents(input.differenceCents ?? (bankBalanceCents - novaBalanceCents));
  const adjustedBalance = !!(input.adjustedBalance ?? existing?.adjustedBalance);
  const reconciledAt = cleanCents(input.reconciledAt ?? existing?.reconciledAt ?? Date.now());
  return {
    id: input.id || existing?.id || `recon_${reconciledAt}_${Math.random().toString(36).slice(2, 8)}`,
    accountKey: input.accountKey || existing?.accountKey || null,
    accountName: input.accountName || existing?.accountName || input.accountKey || existing?.accountKey || 'Account',
    accountRole: input.accountRole || existing?.accountRole || null,
    asOfDate: input.asOfDate || existing?.asOfDate || localDateKey(reconciledAt),
    bankBalanceCents,
    novaBalanceCents,
    differenceCents,
    adjustedBalance,
    resultingBalanceCents: cleanCents(input.resultingBalanceCents ?? existing?.resultingBalanceCents ?? (adjustedBalance ? bankBalanceCents : novaBalanceCents)),
    status: input.status || existing?.status || reconciliationStatusFor({ differenceCents, adjustedBalance }),
    note: String(input.note ?? existing?.note ?? '').trim(),
    reconciledAt,
  };
}

export function sortReconciliations(records = []) {
  return [...(records || [])].sort((a, b) => {
    const aTime = Number(a?.reconciledAt || 0);
    const bTime = Number(b?.reconciledAt || 0);
    return bTime - aTime;
  });
}
