import { CATEGORY_UNCATEGORIZED, canonicalCategoryLabel, categoryKey } from './spendingCategories';

const MAX_IMPORT_BYTES = 2.5 * 1024 * 1024;
const DUPLICATE_WINDOW_MS = 3 * 24 * 60 * 60 * 1000;

const DATE_HEADERS = [
  'date', 'transactiondate', 'posteddate', 'postdate', 'postingdate', 'effectivedate',
  'transdate', 'processdate', 'valuedate', 'posted', 'cleareddate',
];
const DESCRIPTION_HEADERS = [
  'description', 'transactiondescription', 'payee', 'merchant', 'name', 'details',
  'narrative', 'transaction', 'paidto', 'vendor', 'particulars', 'merchantname',
];
const MEMO_HEADERS = ['memo', 'notes', 'note', 'reference', 'details', 'extendeddescription', 'narrative'];
const AMOUNT_HEADERS = ['amount', 'transactionamount', 'amt', 'value', 'netamount', 'signedamount'];
const DEBIT_HEADERS = ['debit', 'withdrawal', 'withdrawals', 'charge', 'charges', 'payment', 'outflow', 'paidout'];
const CREDIT_HEADERS = ['credit', 'deposit', 'deposits', 'received', 'inflow', 'paidin'];
const BALANCE_HEADERS = ['balance', 'runningbalance', 'ledgerbalance', 'availablebalance', 'endingbalance'];
const ID_HEADERS = ['fitid', 'transactionid', 'transactionnumber', 'id', 'referenceid', 'refid', 'confirmationnumber'];
const CHECK_HEADERS = ['check', 'checknumber', 'cheque', 'chequenumber', 'number'];
const TYPE_HEADERS = ['type', 'transactiontype', 'trntype', 'debitcredit', 'drcr'];
const CATEGORY_HEADERS = ['category', 'class', 'glcategory', 'bucket'];
const CURRENCY_HEADERS = ['currency', 'currencycode'];
const ALL_HEADER_CANDIDATES = [
  ...DATE_HEADERS,
  ...DESCRIPTION_HEADERS,
  ...MEMO_HEADERS,
  ...AMOUNT_HEADERS,
  ...DEBIT_HEADERS,
  ...CREDIT_HEADERS,
  ...BALANCE_HEADERS,
  ...ID_HEADERS,
  ...CHECK_HEADERS,
  ...TYPE_HEADERS,
  ...CATEGORY_HEADERS,
  ...CURRENCY_HEADERS,
];

function normalizeHeader(value = '') {
  return String(value || '').toLowerCase().replace(/[^a-z0-9]+/g, '');
}

export function normalizeImportDescription(value = '') {
  return String(value || '')
    .toLowerCase()
    .replace(/\b(pos|debit|card|purchase|auth|pending|sq|tst)\b/g, ' ')
    .replace(/\d{2,}/g, ' ')
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function cleanText(value = '') {
  return String(value ?? '').replace(/\u0000/g, '').replace(/\s+/g, ' ').trim();
}

function pickField(row, headers, candidates) {
  for (const candidate of candidates) {
    const normalized = normalizeHeader(candidate);
    const header = headers.find(item => item.normalized === normalized);
    if (header && cleanText(row[header.index])) return cleanText(row[header.index]);
  }
  for (const candidate of candidates) {
    const normalized = normalizeHeader(candidate);
    const header = headers.find(item => item.normalized.includes(normalized) || normalized.includes(item.normalized));
    if (header && cleanText(row[header.index])) return cleanText(row[header.index]);
  }
  return '';
}

function parseMoneyCents(value) {
  if (value === null || value === undefined) return null;
  let raw = String(value).trim();
  if (!raw) return null;
  const negativeByParens = /^\(.*\)$/.test(raw);
  const commaDecimal = /,\d{1,2}$/.test(raw) && !/\.\d{1,2}$/.test(raw);
  raw = raw
    .replace(/[\s$\u00a3\u20ac\u00a5]/g, '')
    .replace(/[()]/g, '')
    .replace(/\u2212/g, '-');
  raw = commaDecimal ? raw.replace(/\./g, '').replace(',', '.') : raw.replace(/,/g, '');
  const parsed = Number.parseFloat(raw);
  if (!Number.isFinite(parsed)) return null;
  const signed = negativeByParens ? -Math.abs(parsed) : parsed;
  return Math.round(signed * 100);
}

function parseDelimitedLine(line, delimiter) {
  const cells = [];
  let cell = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i += 1) {
    const ch = line[i];
    const next = line[i + 1];
    if (ch === '"' && inQuotes && next === '"') {
      cell += '"';
      i += 1;
    } else if (ch === '"') {
      inQuotes = !inQuotes;
    } else if (ch === delimiter && !inQuotes) {
      cells.push(cell);
      cell = '';
    } else {
      cell += ch;
    }
  }
  cells.push(cell);
  return cells.map(item => item.trim());
}

function splitDelimitedRows(text, delimiter) {
  const rows = [];
  let line = '';
  let inQuotes = false;
  for (let i = 0; i < text.length; i += 1) {
    const ch = text[i];
    const next = text[i + 1];
    if (ch === '"' && inQuotes && next === '"') {
      line += '""';
      i += 1;
    } else if (ch === '"') {
      inQuotes = !inQuotes;
      line += ch;
    } else if ((ch === '\n' || ch === '\r') && !inQuotes) {
      if (ch === '\r' && next === '\n') i += 1;
      if (line.trim()) rows.push(parseDelimitedLine(line, delimiter));
      line = '';
    } else {
      line += ch;
    }
  }
  if (line.trim()) rows.push(parseDelimitedLine(line, delimiter));
  return rows;
}

function detectDelimiter(text) {
  const firstLine = text.split(/\r?\n/).find(line => line.trim()) || '';
  const candidates = [',', '\t', ';', '|'];
  let best = ',';
  let bestCount = 0;
  for (const delimiter of candidates) {
    const count = parseDelimitedLine(firstLine, delimiter).length;
    if (count > bestCount) {
      best = delimiter;
      bestCount = count;
    }
  }
  return best;
}

function inferSlashDateOrder(values) {
  let sawFirstOver12 = false;
  let sawSecondOver12 = false;
  for (const value of values) {
    const match = String(value || '').trim().match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{2,4})/);
    if (!match) continue;
    const a = Number(match[1]);
    const b = Number(match[2]);
    if (a > 12) sawFirstOver12 = true;
    if (b > 12) sawSecondOver12 = true;
  }
  if (sawFirstOver12 && !sawSecondOver12) return 'dmy';
  return 'mdy';
}

function makeLocalNoon(year, monthIndex, day) {
  return new Date(year, monthIndex, day, 12, 0, 0, 0).getTime();
}

function validDateMs(ms) {
  return Number.isFinite(ms) && ms > 0;
}

function parseDateMs(value, slashOrder = 'mdy') {
  const raw = String(value || '').trim();
  if (!raw) return null;
  let match = raw.match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})/);
  if (match) return makeLocalNoon(Number(match[1]), Number(match[2]) - 1, Number(match[3]));

  match = raw.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{2,4})/);
  if (match) {
    const first = Number(match[1]);
    const second = Number(match[2]);
    let year = Number(match[3]);
    if (year < 100) year += year >= 70 ? 1900 : 2000;
    const month = slashOrder === 'dmy' ? second : first;
    const day = slashOrder === 'dmy' ? first : second;
    return makeLocalNoon(year, month - 1, day);
  }

  match = raw.match(/^(\d{1,2})[/-](\d{1,2})['\u2019](\d{2,4})/);
  if (match) {
    const month = Number(match[1]);
    const day = Number(match[2]);
    let year = Number(match[3]);
    if (year < 100) year += year >= 70 ? 1900 : 2000;
    return makeLocalNoon(year, month - 1, day);
  }

  const parsed = new Date(raw).getTime();
  return Number.isFinite(parsed) ? parsed : null;
}

function parseOfxDate(value) {
  const raw = String(value || '').trim();
  const match = raw.match(/^(\d{4})(\d{2})(\d{2})/);
  if (!match) return parseDateMs(raw);
  return makeLocalNoon(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
}

function isoDate(ms) {
  if (!ms) return '';
  const d = new Date(ms);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function tagValue(block, tag) {
  const xml = new RegExp(`<${tag}[^>]*>([\\s\\S]*?)</${tag}>`, 'i').exec(block);
  if (xml) return cleanText(xml[1]);
  const sgml = new RegExp(`<${tag}[^>]*>([^<\\r\\n]*)`, 'i').exec(block);
  return sgml ? cleanText(sgml[1]) : '';
}

function extractBlocks(text, tag) {
  const blocks = [];
  const re = new RegExp(`<${tag}[^>]*>([\\s\\S]*?)</${tag}>`, 'gi');
  let match;
  while ((match = re.exec(text))) blocks.push(match[1]);
  return blocks;
}

function baseRecord(input) {
  const description = cleanText(input.description || input.payee || input.memo || 'Imported transaction');
  const normalizedDescription = normalizeImportDescription(`${description} ${input.memo || ''}`);
  const timestamp = input.timestamp || Date.now();
  return {
    id: input.id || `import_row_${Math.random().toString(36).slice(2, 9)}`,
    format: input.format,
    timestamp,
    date: isoDate(timestamp),
    amountCents: Math.trunc(input.amountCents || 0),
    description,
    payee: cleanText(input.payee),
    memo: cleanText(input.memo),
    rawDescription: cleanText(input.rawDescription || description),
    normalizedDescription,
    importedCategory: input.importedCategory ? canonicalCategoryLabel(input.importedCategory) : '',
    category: input.category || '',
    externalId: cleanText(input.externalId),
    checkNumber: cleanText(input.checkNumber),
    transactionType: cleanText(input.transactionType),
    balanceCents: input.balanceCents ?? null,
    currency: cleanText(input.currency),
    raw: input.raw || {},
  };
}

function inferCsvHeaders(rows = []) {
  const sample = rows.slice(0, 25);
  const colCount = Math.max(...sample.map(row => row.length), 0);
  let dateIndex = -1;
  let amountIndex = -1;
  let debitIndex = -1;
  let creditIndex = -1;
  let descriptionIndex = -1;
  let bestDateScore = 0;
  let bestAmountScore = 0;
  let bestDebitScore = 0;
  let bestCreditScore = 0;
  let bestTextScore = 0;

  for (let index = 0; index < colCount; index += 1) {
    const values = sample.map(row => cleanText(row[index]));
    const dateScore = values.filter(value => validDateMs(parseDateMs(value))).length;
    const moneyValues = values
      .filter(value => !validDateMs(parseDateMs(value)))
      .map(parseMoneyCents)
      .filter(value => value != null && value !== 0);
    const amountScore = moneyValues.length;
    const debitScore = moneyValues.filter(value => value < 0).length;
    const creditScore = moneyValues.filter(value => value > 0).length;
    const textScore = values
      .filter(value => value && parseMoneyCents(value) == null && !validDateMs(parseDateMs(value)))
      .reduce((sum, value) => sum + Math.min(value.length, 40), 0);

    if (dateScore > bestDateScore) {
      bestDateScore = dateScore;
      dateIndex = index;
    }
    if (amountScore > bestAmountScore) {
      bestAmountScore = amountScore;
      amountIndex = index;
    }
    if (debitScore > bestDebitScore) {
      bestDebitScore = debitScore;
      debitIndex = index;
    }
    if (creditScore > bestCreditScore) {
      bestCreditScore = creditScore;
      creditIndex = index;
    }
    if (textScore > bestTextScore) {
      bestTextScore = textScore;
      descriptionIndex = index;
    }
  }

  return Array.from({ length: colCount }, (_, index) => {
    let label = `col_${index + 1}`;
    if (index === dateIndex) label = 'date';
    else if (debitIndex !== creditIndex && index === debitIndex && bestDebitScore > 0) label = 'debit';
    else if (debitIndex !== creditIndex && index === creditIndex && bestCreditScore > 0) label = 'credit';
    else if (index === amountIndex) label = 'amount';
    else if (index === descriptionIndex) label = 'description';
    return { label, normalized: normalizeHeader(label), index };
  });
}

function parseCsv(text) {
  const delimiter = detectDelimiter(text);
  const rows = splitDelimitedRows(text, delimiter);
  if (rows.length < 1) return { format: 'csv', rows: [], warnings: ['CSV did not contain data rows.'] };
  let headers = rows[0].map((label, index) => ({ label: cleanText(label), normalized: normalizeHeader(label), index }));
  const knownHeaderHits = headers.filter(header =>
    ALL_HEADER_CANDIDATES.some(candidate => normalizeHeader(candidate) === header.normalized)
  ).length;
  const hasHeader = knownHeaderHits >= 2;
  const dataRows = hasHeader ? rows.slice(1) : rows;
  if (!hasHeader) headers = inferCsvHeaders(dataRows);
  const dateValues = dataRows.map(row => pickField(row, headers, DATE_HEADERS));
  const slashOrder = inferSlashDateOrder(dateValues);
  const parsed = [];
  const warnings = [];

  dataRows.forEach((row, rowIndex) => {
    const rawDate = pickField(row, headers, DATE_HEADERS);
    const timestamp = parseDateMs(rawDate, slashOrder);
    const amountRaw = pickField(row, headers, AMOUNT_HEADERS);
    const debitRaw = pickField(row, headers, DEBIT_HEADERS);
    const creditRaw = pickField(row, headers, CREDIT_HEADERS);
    const typeRaw = pickField(row, headers, TYPE_HEADERS);
    let amountCents = parseMoneyCents(amountRaw);
    if (amountCents == null) {
      const debit = parseMoneyCents(debitRaw);
      const credit = parseMoneyCents(creditRaw);
      if (debit != null && debit !== 0) amountCents = -Math.abs(debit);
      else if (credit != null && credit !== 0) amountCents = Math.abs(credit);
    } else if (amountCents > 0 && /\b(debit|withdrawal|purchase|payment|charge|dr)\b/i.test(typeRaw)) {
      amountCents = -Math.abs(amountCents);
    } else if (amountCents < 0 && /\b(credit|deposit|cr)\b/i.test(typeRaw)) {
      amountCents = Math.abs(amountCents);
    }
    if (!timestamp || amountCents == null || amountCents === 0) {
      warnings.push(`Skipped CSV row ${rowIndex + (hasHeader ? 2 : 1)}: missing date or amount.`);
      return;
    }
    const description = pickField(row, headers, DESCRIPTION_HEADERS);
    const memo = pickField(row, headers, MEMO_HEADERS);
    const importedCategory = pickField(row, headers, CATEGORY_HEADERS);
    const raw = {};
    headers.forEach(header => { raw[header.label || `col_${header.index}`] = row[header.index] || ''; });
    parsed.push(baseRecord({
      id: `csv_${rowIndex}`,
      format: 'csv',
      timestamp,
      amountCents,
      description: description || memo || 'CSV transaction',
      payee: description,
      memo: memo && memo !== description ? memo : '',
      rawDescription: [description, memo].filter(Boolean).join(' - '),
      importedCategory,
      externalId: pickField(row, headers, ID_HEADERS),
      checkNumber: pickField(row, headers, CHECK_HEADERS),
      transactionType: typeRaw,
      balanceCents: parseMoneyCents(pickField(row, headers, BALANCE_HEADERS)),
      currency: pickField(row, headers, CURRENCY_HEADERS),
      raw,
    }));
  });

  return { format: 'csv', rows: parsed, warnings, delimiter, inferredHeader: !hasHeader };
}

function parseOfx(text, format = 'ofx') {
  const blocks = extractBlocks(text, 'STMTTRN');
  const warnings = [];
  const rows = blocks.map((block, index) => {
    const payeeName = tagValue(tagValue(block, 'PAYEE'), 'NAME');
    const name = tagValue(block, 'NAME') || payeeName;
    const memo = tagValue(block, 'MEMO') || tagValue(block, 'EXTDNAME');
    const amountCents = parseMoneyCents(tagValue(block, 'TRNAMT')) || 0;
    return baseRecord({
      id: `${format}_${index}`,
      format,
      timestamp: parseOfxDate(tagValue(block, 'DTPOSTED') || tagValue(block, 'DTUSER') || tagValue(block, 'DTAVAIL')),
      amountCents,
      description: name || memo || 'OFX transaction',
      payee: name,
      memo,
      rawDescription: [name, memo].filter(Boolean).join(' - '),
      externalId: tagValue(block, 'FITID') || tagValue(block, 'SRVRTID'),
      checkNumber: tagValue(block, 'CHECKNUM') || tagValue(block, 'REFNUM'),
      transactionType: tagValue(block, 'TRNTYPE'),
      currency: tagValue(block, 'CURRENCY') || tagValue(text, 'CURDEF'),
      raw: {
        TRNTYPE: tagValue(block, 'TRNTYPE'),
        DTPOSTED: tagValue(block, 'DTPOSTED'),
        TRNAMT: tagValue(block, 'TRNAMT'),
        FITID: tagValue(block, 'FITID'),
        CHECKNUM: tagValue(block, 'CHECKNUM'),
        REFNUM: tagValue(block, 'REFNUM'),
        NAME: name,
        MEMO: memo,
      },
    });
  }).filter(row => {
    const ok = row.timestamp && row.amountCents !== 0;
    if (!ok) warnings.push('Skipped OFX transaction missing date or amount.');
    return ok;
  });
  return { format, rows, warnings };
}

function parseQif(text) {
  const lines = text.replace(/\r/g, '').split('\n');
  const warnings = [];
  const rows = [];
  let current = {};
  let recordIndex = 0;
  let qifType = '';
  const flush = () => {
    if (Object.keys(current).length === 0) return;
    const timestamp = parseDateMs(current.D || '', 'mdy');
    const amountCents = parseMoneyCents(current.T || current.U);
    if (!timestamp || amountCents == null || amountCents === 0) {
      warnings.push(`Skipped QIF record ${recordIndex + 1}: missing date or amount.`);
      current = {};
      recordIndex += 1;
      return;
    }
    rows.push(baseRecord({
      id: `qif_${recordIndex}`,
      format: 'qif',
      timestamp,
      amountCents,
      description: current.P || current.M || 'QIF transaction',
      payee: current.P,
      memo: current.M,
      rawDescription: [current.P, current.M].filter(Boolean).join(' - '),
      importedCategory: current.L,
      checkNumber: current.N,
      transactionType: qifType,
      raw: current,
    }));
    current = {};
    recordIndex += 1;
  };

  lines.forEach((line) => {
    if (!line.trim()) return;
    if (line.startsWith('!Type:')) {
      qifType = line.slice(6).trim();
      return;
    }
    if (line.trim() === '^') {
      flush();
      return;
    }
    const code = line[0];
    const value = line.slice(1).trim();
    if (['D', 'T', 'U', 'M', 'C', 'N', 'P', 'L'].includes(code)) {
      current[code] = value;
    } else if (code === 'S' || code === 'E' || code === '$') {
      current.splits = [...(current.splits || []), { code, value }];
    }
  });
  flush();
  return { format: 'qif', rows, warnings, qifType };
}

function detectFormat(text, fileName = '') {
  const lowerName = String(fileName || '').toLowerCase();
  const sample = text.slice(0, 500).toLowerCase();
  if (lowerName.endsWith('.qfx')) return 'qfx';
  if (lowerName.endsWith('.ofx') || sample.includes('<ofx') || sample.includes('<stmttrn')) return 'ofx';
  if (lowerName.endsWith('.qif') || sample.includes('!type:')) return 'qif';
  return 'csv';
}

export function parseStatementText(text, fileName = '') {
  if (String(text || '').length > MAX_IMPORT_BYTES) {
    throw new Error('Statement file is too large for local import review.');
  }
  const safeText = String(text || '').replace(/\u0000/g, '').slice(0, MAX_IMPORT_BYTES);
  const format = detectFormat(safeText, fileName);
  if (format === 'ofx' || format === 'qfx') return parseOfx(safeText, format);
  if (format === 'qif') return parseQif(safeText);
  return parseCsv(safeText);
}

export function applyCategoryRules(rows = [], rules = [], fallback = CATEGORY_UNCATEGORIZED) {
  const activeRules = (rules || [])
    .filter(rule => rule?.pattern && rule?.category)
    .sort((a, b) => String(b.pattern).length - String(a.pattern).length);
  return (rows || []).map(row => {
    const normalized = row.normalizedDescription || normalizeImportDescription(row.rawDescription || row.description);
    const matched = activeRules.find(rule => normalized.includes(rule.pattern));
    return {
      ...row,
      category: matched?.category || row.importedCategory || fallback,
      suggestedByRule: matched?.pattern || null,
    };
  });
}

export function buildImportFingerprint(row, accountKey, format = row?.format || 'statement') {
  const date = row?.date || isoDate(row?.timestamp);
  const desc = row?.normalizedDescription || normalizeImportDescription(row?.rawDescription || row?.description);
  if (row?.externalId) return `${accountKey}|${format}|id|${row.externalId}`;
  return `${accountKey}|${format}|${date}|${row?.amountCents || 0}|${desc}`;
}

export function flagDuplicateRows(rows = [], existingTransactions = [], accountKey, format) {
  const existing = (existingTransactions || []).filter(tx => tx && !tx.deleted && tx.accountKey === accountKey);
  const seenExact = new Set();
  const seenFuzzy = new Set();
  return (rows || []).map(row => {
    const fingerprint = buildImportFingerprint(row, accountKey, format || row.format);
    const normalized = row.normalizedDescription || normalizeImportDescription(row.rawDescription || row.description);
    const inFileKey = row.externalId ? `id|${row.externalId}` : fingerprint;
    const inFileFuzzyKey = `${row.date || isoDate(row.timestamp)}|${row.amountCents || 0}|${normalized}`;
    if (seenExact.has(inFileKey) || seenFuzzy.has(inFileFuzzyKey)) {
      return { ...row, importFingerprint: fingerprint, duplicate: true, duplicateReason: 'same file duplicate' };
    }
    const exact = existing.find(tx =>
      (row.externalId && (tx.importExternalId === row.externalId || tx.sourceId === row.externalId)) ||
      (tx.importFingerprint && tx.importFingerprint === fingerprint)
    );
    if (exact) {
      return { ...row, importFingerprint: fingerprint, duplicate: true, duplicateReason: 'same statement ID' };
    }
    const fuzzy = existing.find(tx => {
      if ((tx.amountCents || 0) !== row.amountCents) return false;
      if (Math.abs((tx.timestamp || 0) - (row.timestamp || 0)) > DUPLICATE_WINDOW_MS) return false;
      const txDesc = normalizeImportDescription(tx.importRawDescription || tx.description || '');
      return txDesc === normalized ||
        (txDesc.length > 5 && normalized.includes(txDesc)) ||
        (normalized.length > 5 && txDesc.includes(normalized));
    });
    if (fuzzy) {
      return { ...row, importFingerprint: fingerprint, duplicate: true, duplicateReason: 'similar date/amount/description' };
    }
    seenExact.add(inFileKey);
    seenFuzzy.add(inFileFuzzyKey);
    return { ...row, importFingerprint: fingerprint, duplicate: false, duplicateReason: '' };
  });
}

export function buildCategoryRulesFromRows(rows = []) {
  const byPattern = new Map();
  const now = Date.now();
  (rows || []).forEach(row => {
    const pattern = row.normalizedDescription || normalizeImportDescription(row.rawDescription || row.description);
    const category = canonicalCategoryLabel(row.category || CATEGORY_UNCATEGORIZED);
    if (!pattern || !category) return;
    const existing = byPattern.get(pattern);
    byPattern.set(pattern, {
      pattern,
      category,
      count: (existing?.count || 0) + 1,
      updatedAt: now,
    });
  });
  return Array.from(byPattern.values());
}
