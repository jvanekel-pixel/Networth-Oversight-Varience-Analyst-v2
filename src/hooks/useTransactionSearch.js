import { useMemo } from 'react';

function getAmountCents(tx) {
  return tx?.amountCents ?? tx?.amount ?? 0;
}

function getTimestamp(tx) {
  return tx?.timestamp ?? tx?.date ?? 0;
}

function startOfIsoDate(value) {
  if (!value) return null;
  const parts = String(value).split('-').map(Number);
  if (parts.length === 3 && parts.every(Boolean)) {
    return new Date(parts[0], parts[1] - 1, parts[2], 0, 0, 0, 0).getTime();
  }
  const parsed = new Date(value).getTime();
  return Number.isFinite(parsed) ? parsed : null;
}

function endOfIsoDate(value) {
  if (!value) return null;
  const parts = String(value).split('-').map(Number);
  if (parts.length === 3 && parts.every(Boolean)) {
    return new Date(parts[0], parts[1] - 1, parts[2], 23, 59, 59, 999).getTime();
  }
  const parsed = new Date(value).getTime();
  return Number.isFinite(parsed) ? parsed : null;
}

function matchesQuery(tx, query) {
  if (!query) return true;
  const needle = String(query).trim().toLowerCase();
  if (!needle) return true;
  return [
    tx?.description,
    tx?.category,
    tx?.accountKey,
    tx?.source,
    tx?.businessId,
  ].some(value => String(value || '').toLowerCase().includes(needle));
}

export default function useTransactionSearch(transactions = [], filters = {}) {
  return useMemo(() => {
    const dateFromMs = startOfIsoDate(filters.dateFrom);
    const dateToMs = endOfIsoDate(filters.dateTo);
    const accountKeys = Array.isArray(filters.accountKeys) ? filters.accountKeys.filter(Boolean) : null;
    const sources = Array.isArray(filters.sources) ? filters.sources.filter(Boolean) : null;

    return [...(transactions || [])]
      .filter(tx => {
        if (!tx || tx.deleted === true) return false;
        const amount = getAmountCents(tx);
        const timestamp = getTimestamp(tx);

        if (!matchesQuery(tx, filters.query)) return false;
        const hasAccountFilter = !!filters.accountKey || (accountKeys && accountKeys.length > 0);
        const hasSourceFilter = !!filters.source || (sources && sources.length > 0);
        const accountMatches = (!filters.accountKey || tx.accountKey === filters.accountKey) &&
          (!accountKeys || accountKeys.length === 0 || accountKeys.includes(tx.accountKey));
        const sourceMatches = (!filters.source || tx.source === filters.source) &&
          (!sources || sources.length === 0 || sources.includes(tx.source));
        if (filters.matchScope === 'any' && (hasAccountFilter || hasSourceFilter)) {
          if (!((hasAccountFilter && accountMatches) || (hasSourceFilter && sourceMatches))) return false;
        } else {
          if (hasAccountFilter && !accountMatches) return false;
          if (hasSourceFilter && !sourceMatches) return false;
        }
        if (filters.category && tx.category !== filters.category) return false;
        if (filters.type === 'debit' && amount >= 0) return false;
        if (filters.type === 'credit' && amount <= 0) return false;
        if (filters.minAmount != null && Math.abs(amount) < filters.minAmount) return false;
        if (filters.maxAmount != null && Math.abs(amount) > filters.maxAmount) return false;
        if (dateFromMs != null && timestamp < dateFromMs) return false;
        if (dateToMs != null && timestamp > dateToMs) return false;
        return true;
      })
      .sort((a, b) => getTimestamp(b) - getTimestamp(a));
  }, [transactions, filters]);
}
