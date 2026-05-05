import {
  CATEGORY_UNCATEGORIZED,
  canonicalCategoryLabel,
  categoryKey,
  dedupeCategoryLabels,
  SPENDING_CATEGORY_COLOR_ORDER,
} from './spendingCategories';

const MONTH_LABELS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

function getAmountCents(record) {
  const amount = record?.amountCents ?? record?.amount ?? record?.totalCents ?? 0;
  const numeric = Number(amount);
  return Number.isFinite(numeric) ? Math.trunc(numeric) : 0;
}

function getRecordMs(record) {
  const raw = record?.timestamp ?? record?.date ?? record?.createdAt ?? record?.paidDate ?? null;
  if (!raw) return null;
  const ms = raw instanceof Date ? raw.getTime() : new Date(raw).getTime();
  return Number.isFinite(ms) ? ms : null;
}

function normalizeDayStart(value) {
  const d = value instanceof Date ? new Date(value) : new Date(value);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

function normalizeDayEnd(value) {
  const d = value instanceof Date ? new Date(value) : new Date(value);
  d.setHours(23, 59, 59, 999);
  return d.getTime();
}

function isTransfer(record) {
  if (record?.transferGroupId || record?.sourceType === 'account_transfer') return true;
  const fields = [
    record?.type,
    record?.source,
    record?.category,
  ].map(value => String(value || '').toLowerCase());
  if (fields.some(value => value === 'transfer' || value === 'account_transfer')) return true;
  return /^transfer(\s|:|-|$)/.test(String(record?.description || '').toLowerCase());
}

function categoryLabel(record) {
  return canonicalCategoryLabel(record?.category, CATEGORY_UNCATEGORIZED);
}

function themeOtherColor(themeColors) {
  return themeColors?.categoryColors?.Other || themeColors?.muted || themeColors?.textDim || 'transparent';
}

function colorForIndex(index, themeColors) {
  const palette = Array.isArray(themeColors?.chartPalette) ? themeColors.chartPalette : [];
  return palette[index % Math.max(palette.length, 1)] || themeOtherColor(themeColors);
}

function themeCategoryColor(category, themeColors) {
  const categoryColors = themeColors?.categoryColors || {};
  const key = categoryKey(category);
  const match = Object.entries(categoryColors).find(([name]) => categoryKey(name) === key);
  return match?.[1] || null;
}

function hashCategory(value) {
  return categoryKey(value).split('').reduce((sum, char) => sum + char.charCodeAt(0), 0);
}

function colorForCategory(category, themeColors, categoryOrder = []) {
  const mappedColor = themeCategoryColor(category, themeColors);
  if (mappedColor) return mappedColor;
  const order = dedupeCategoryLabels([...categoryOrder, ...SPENDING_CATEGORY_COLOR_ORDER]);
  const key = categoryKey(category);
  const index = order.findIndex(item => categoryKey(item) === key);
  if (index >= 0) return colorForIndex(index, themeColors);
  return colorForIndex(order.length + hashCategory(category), themeColors);
}

function isInRange(ms, startMs, endMs) {
  return ms != null && ms >= startMs && ms <= endMs;
}

function activeDebit(record) {
  if (!record || record.deleted === true || isTransfer(record)) return 0;
  const amount = getAmountCents(record);
  return amount < 0 ? Math.abs(amount) : 0;
}

function monthKey(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
}

function monthStart(date) {
  return new Date(date.getFullYear(), date.getMonth(), 1, 0, 0, 0, 0);
}

function classifyTransaction(record, accountRegistry = []) {
  const profile = String(record?.profile || record?.sourceProfile || '').toLowerCase();
  if (profile === 'business' || profile === 'household' || profile === 'personal') {
    return profile;
  }
  const source = String(record?.source || '').toLowerCase();
  const accountKey = record?.accountKey;
  const account = (accountRegistry || []).find(a => a && (a.id === accountKey || a.legacyKey === accountKey));
  if (account?.role === 'business' || source === 'business') {
    return 'business';
  }
  if (account?.role === 'household' || source === 'household') return 'household';
  if (account?.role === 'personal' || source === 'personal') return 'personal';
  return 'personal';
}

function matchesProfile(record, profile = 'overall', accountRegistry = []) {
  if (!profile || profile === 'overall' || profile === 'dashboard') return true;
  return classifyTransaction(record, accountRegistry) === profile;
}

function addBusinessExpenses(monthBuckets, records) {
  (records || []).forEach(record => {
    if (!record || record.deleted === true) return;
    const ms = getRecordMs(record);
    if (ms == null) return;
    const d = new Date(ms);
    const key = monthKey(d);
    if (!monthBuckets.has(key)) return;
    const amount = Math.abs(getAmountCents(record));
    if (amount <= 0) return;
    monthBuckets.get(key).business += amount;
  });
}

function monthEnd(date) {
  return new Date(date.getFullYear(), date.getMonth() + 1, 0, 23, 59, 59, 999);
}

function normalizeMonthCount(value, fallback = 6) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return fallback;
  return Math.max(1, Math.min(24, Math.trunc(numeric)));
}

function normalizeLimit(value, fallback = 6) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return fallback;
  return Math.max(1, Math.min(12, Math.trunc(numeric)));
}

function monthBucketsForWindow(now, monthCount, categories = []) {
  const current = monthStart(new Date(now));
  const categoryList = dedupeCategoryLabels(categories);
  const months = [];
  const monthBuckets = new Map();

  for (let offset = monthCount - 1; offset >= 0; offset -= 1) {
    const d = new Date(current.getFullYear(), current.getMonth() - offset, 1);
    const key = monthKey(d);
    const bucket = { month: MONTH_LABELS[d.getMonth()], key };
    categoryList.forEach(category => { bucket[category] = 0; });
    months.push(bucket);
    monthBuckets.set(key, bucket);
  }

  return { months, monthBuckets, categoryList };
}

export function buildCategorySlices(transactions, cycleStartDate, cycleEndDate, themeColors = {}, options = {}) {
  const startMs = normalizeDayStart(cycleStartDate);
  const endMs = normalizeDayEnd(cycleEndDate);
  const totals = new Map();
  const profile = options.profile || 'overall';
  const accountRegistry = options.accountRegistry || [];
  const categoryOrder = options.categoryOrder || [];

  (transactions || []).forEach(tx => {
    const ms = getRecordMs(tx);
    const amount = activeDebit(tx);
    if (amount <= 0 || !isInRange(ms, startMs, endMs) || !matchesProfile(tx, profile, accountRegistry)) return;
    const category = categoryLabel(tx);
    totals.set(category, (totals.get(category) || 0) + amount);
  });

  const rows = Array.from(totals.entries())
    .map(([category, totalCents]) => ({ category, totalCents }))
    .sort((a, b) => b.totalCents - a.totalCents);

  let visible = rows;
  if (rows.length > 7) {
    const kept = rows.slice(0, 6);
    const overflow = rows.slice(6);
    const overflowTotal = overflow.reduce((sum, row) => sum + row.totalCents, 0);
    const existingOther = kept.find(row => row.category === 'Other');
    if (existingOther) {
      existingOther.totalCents += overflowTotal;
      existingOther.categoryCount = (existingOther.categoryCount || 1) + overflow.length;
      visible = kept;
    } else {
      visible = [
        ...kept,
        {
          category: 'Other',
          totalCents: overflowTotal,
          categoryCount: overflow.length,
        },
      ];
    }
  }

  return visible.map((row, index) => ({
    ...row,
    color: row.category === 'Other' ? themeOtherColor(themeColors) : colorForCategory(row.category, themeColors, categoryOrder),
  }));
}

export function buildMonthlyCategoryTotals(
  transactions,
  now = Date.now(),
  accountRegistry = [],
  profile = 'overall',
  categories = [],
  options = {},
) {
  const monthCount = normalizeMonthCount(options.monthCount, 6);
  const { months, monthBuckets, categoryList } = monthBucketsForWindow(now, monthCount, categories);
  const categoryKeys = new Set(categoryList.map(categoryKey));

  (transactions || []).forEach(tx => {
    const ms = getRecordMs(tx);
    const amount = activeDebit(tx);
    if (amount <= 0 || ms == null || !matchesProfile(tx, profile, accountRegistry)) return;
    const category = categoryLabel(tx);
    if (categoryKeys.size > 0 && !categoryKeys.has(categoryKey(category))) return;
    const key = monthKey(new Date(ms));
    if (!monthBuckets.has(key)) return;
    monthBuckets.get(key)[category] = (monthBuckets.get(key)[category] || 0) + amount;
  });

  return months.map(({ key, ...month }) => month);
}

export function buildTopCategorySeriesForRange(
  transactions,
  now = Date.now(),
  accountRegistry = [],
  profile = 'overall',
  themeColors = {},
  options = {},
) {
  const monthCount = normalizeMonthCount(options.monthCount, 6);
  const limit = normalizeLimit(options.limit, 6);
  const categoryOrder = options.categoryOrder || [];
  const current = monthStart(new Date(now));
  const startMs = new Date(current.getFullYear(), current.getMonth() - (monthCount - 1), 1).getTime();
  const endMs = monthEnd(current).getTime();
  const totals = new Map();

  (transactions || []).forEach(tx => {
    const ms = getRecordMs(tx);
    const amount = activeDebit(tx);
    if (amount <= 0 || !isInRange(ms, startMs, endMs) || !matchesProfile(tx, profile, accountRegistry)) return;
    const category = categoryLabel(tx);
    totals.set(category, (totals.get(category) || 0) + amount);
  });

  return Array.from(totals.entries())
    .map(([category, totalCents]) => ({
      key: category,
      label: category,
      totalCents,
      color: colorForCategory(category, themeColors, categoryOrder),
    }))
    .sort((a, b) => b.totalCents - a.totalCents)
    .slice(0, limit);
}

export function buildYearOverYearCategoryTotals(
  transactions,
  now = Date.now(),
  accountRegistry = [],
  profile = 'overall',
  themeColors = {},
  options = {},
) {
  const monthCount = normalizeMonthCount(options.monthCount, 12);
  const limit = normalizeLimit(options.limit, 8);
  const categoryOrder = options.categoryOrder || [];
  const current = monthStart(new Date(now));
  const currentStart = new Date(current.getFullYear(), current.getMonth() - (monthCount - 1), 1);
  const currentEnd = monthEnd(current);
  const previousStart = new Date(current.getFullYear(), current.getMonth() - ((monthCount * 2) - 1), 1);
  const previousEnd = monthEnd(new Date(current.getFullYear(), current.getMonth() - monthCount, 1));
  const currentStartMs = currentStart.getTime();
  const currentEndMs = currentEnd.getTime();
  const previousStartMs = previousStart.getTime();
  const previousEndMs = previousEnd.getTime();
  const rows = new Map();

  (transactions || []).forEach(tx => {
    const ms = getRecordMs(tx);
    const amount = activeDebit(tx);
    if (amount <= 0 || ms == null || !matchesProfile(tx, profile, accountRegistry)) return;
    if (!isInRange(ms, previousStartMs, currentEndMs)) return;
    const category = categoryLabel(tx);
    const key = categoryKey(category);
    const row = rows.get(key) || {
      key,
      category,
      currentCents: 0,
      previousCents: 0,
      color: colorForCategory(category, themeColors, categoryOrder),
    };
    if (isInRange(ms, currentStartMs, currentEndMs)) {
      row.currentCents += amount;
    } else if (isInRange(ms, previousStartMs, previousEndMs)) {
      row.previousCents += amount;
    }
    rows.set(key, row);
  });

  return Array.from(rows.values())
    .map(row => {
      const deltaCents = row.currentCents - row.previousCents;
      const deltaPct = row.previousCents > 0 ? (deltaCents / row.previousCents) * 100 : null;
      return {
        ...row,
        deltaCents,
        deltaPct,
      };
    })
    .filter(row => row.currentCents > 0 || row.previousCents > 0)
    .sort((a, b) => (b.currentCents + b.previousCents) - (a.currentCents + a.previousCents))
    .slice(0, limit);
}

export function buildMonthlyTotals(transactions, now = Date.now(), accountRegistry = [], profile = 'overall') {
  const current = monthStart(new Date(now));
  const months = [];
  const monthBuckets = new Map();

  for (let offset = 5; offset >= 0; offset -= 1) {
    const d = new Date(current.getFullYear(), current.getMonth() - offset, 1);
    const key = monthKey(d);
    const bucket = {
      month: MONTH_LABELS[d.getMonth()],
      household: 0,
      personal: 0,
      business: 0,
      key,
    };
    months.push(bucket);
    monthBuckets.set(key, bucket);
  }

  (transactions || []).forEach(tx => {
    const ms = getRecordMs(tx);
    const amount = activeDebit(tx);
    if (amount <= 0 || ms == null || !matchesProfile(tx, profile, accountRegistry)) return;
    const key = monthKey(new Date(ms));
    if (!monthBuckets.has(key)) return;
    const zone = classifyTransaction(tx, accountRegistry);
    monthBuckets.get(key)[zone] += amount;
  });

  return months.map(({ month, household, personal, business }) => ({
    month,
    household,
    personal,
    business,
  }));
}

function fillTemplate(template, values) {
  return Object.entries(values).reduce(
    (text, [key, value]) => text.replace(new RegExp(`\\{${key}\\}`, 'g'), String(value)),
    template,
  );
}

function firstLine(lines, fallback) {
  return Array.isArray(lines) && lines.length > 0 ? lines[0] : fallback;
}

export function getChartReaction(slices, priorMonthSlices, personalityConfig = {}) {
  const reactions = personalityConfig.chartReactions || {};
  const current = slices || [];
  const prior = priorMonthSlices || null;
  const total = current.reduce((sum, slice) => sum + (slice.totalCents || 0), 0);

  if (total <= 0) {
    return firstLine(reactions.noTransactions, 'No transactions this cycle.');
  }

  if (prior && prior.length > 0) {
    const priorByCategory = new Map(prior.map(slice => [slice.category, slice.totalCents || 0]));
    const spike = current.find(slice => {
      const priorTotal = priorByCategory.get(slice.category) || 0;
      if (priorTotal <= 0) return false;
      const growthPct = ((slice.totalCents - priorTotal) / priorTotal) * 100;
      return growthPct > 150;
    });

    if (spike) {
      const priorTotal = priorByCategory.get(spike.category) || 1;
      const pct = Math.round(((spike.totalCents - priorTotal) / priorTotal) * 100);
      return fillTemplate(
        firstLine(reactions.categorySpike, '{category} spiked {pct}%. Flagged.'),
        { category: spike.category, pct },
      );
    }

    const allUnderPrior = current.length > 0 && current.every(slice => {
      const priorTotal = priorByCategory.get(slice.category) || 0;
      return priorTotal > 0 && slice.totalCents < priorTotal;
    });
    if (allUnderPrior) {
      return firstLine(reactions.allGreen, 'Controlled spend across all categories.');
    }
  }

  const top = current[0];
  const pct = total > 0 ? Math.round((top.totalCents / total) * 100) : 0;
  return fillTemplate(
    firstLine(reactions.topCategory, '{category}: {pct}% of cycle spend.'),
    { category: top.category, pct },
  );
}
