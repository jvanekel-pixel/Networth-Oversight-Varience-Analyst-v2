import { receiptCount, receiptFileSummary } from './receiptFiles';

function esc(v) {
  if (v === null || v === undefined) return '';
  const s = String(v);
  return s.includes(',') || s.includes('"') || s.includes('\n') ? `"${s.replace(/"/g, '""')}"` : s;
}

function htmlEsc(v) {
  if (v === null || v === undefined) return '';
  return String(v)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function dateIso(value) {
  if (!value) return '';
  if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)) return value;
  const d = new Date(value);
  if (!Number.isFinite(d.getTime())) return '';
  return d.toISOString().slice(0, 10);
}

function businessNameById(businesses = []) {
  const map = new Map();
  (businesses || []).forEach(business => {
    if (business?.id) map.set(business.id, business.name || business.id);
  });
  return map;
}

function accountNameByKey(accountRegistry = []) {
  const map = new Map();
  (accountRegistry || []).forEach(account => {
    const key = account?.legacyKey || account?.id;
    if (key) map.set(key, account.name || account.id);
    if (account?.id) map.set(account.id, account.name || account.id);
  });
  return map;
}

export function buildFullJsonExport(allKeys, scope = 'all', extras = {}) {
  return JSON.stringify({
    schemaVersion: 2,
    exportType: 'nova_backup',
    scope,
    exportedAt: new Date().toISOString(),
    ...(Array.isArray(extras.receiptFiles) ? { receiptFiles: extras.receiptFiles } : {}),
    data: allKeys,
  }, null, 2);
}

export function buildExportManifest({ scope = 'all', appVersion = '1.0.0', files = [], exportKind = 'backup', destinationLabel = '' }) {
  const columnNotes = {
    business_summary: 'Business, Business ID, income/expense/net totals, mileage totals, and mileage deduction totals.',
    business_income: 'ISO date, business name/id, vendor/client source, category, amount dollars/cents, account name/key, notes, receipt filenames, and transaction id.',
    business_expenses: 'ISO date, business name/id, vendor/client/vendor detail, category, deductible flag, amount dollars/cents, account name/key, notes, receipt filenames, and transaction id.',
    business_mileage: 'ISO date, business name/id, mileage category, deductible flag, miles, purpose/notes, IRS rate, and mileage deduction dollars/cents.',
    business_transactions: 'ISO date, business name/id, account name/key, description, category, amount dollars/cents, balance after, source type/id, receipt filenames, and transaction id.',
    account_csv: 'ISO date, description, category, amount, balance after, payment method, and receipt filenames.',
    account_pdf: 'Human-readable PDF account register with date, description, category, amount, balance after, source, receipt count, and transaction id.',
    json_backup: 'Import-ready NOVA JSON data. Full backups replace all app data; scoped backups merge matching profile data. Receipt images are embedded in the backup and restored into local app storage during import.',
    encrypted_json_backup: 'Password-protected NOVA backup envelope using AES-256-GCM. Import requires the same backup password.',
  };
  const lines = [
    'N.O.V.A. Export Manifest',
    `Export Date: ${new Date().toISOString()}`,
    `App Version: ${appVersion}`,
    `Scope: ${scope}`,
    `Export Kind: ${exportKind}`,
    `Destination: ${destinationLabel || 'Chosen in Android share sheet for this run'}`,
    'Privacy Model: offline-first, no login, no ads, manual records stored on-device.',
    'Portability: JSON backups can be imported back into NOVA. Encrypted JSON backups require the backup password. CSV files can be opened in spreadsheet or bookkeeping tools.',
    '',
    'Included Files:',
    ...(files.length > 0 ? files.map(file => `- ${file}`) : ['- No files listed']),
    '',
    'Column Notes:',
  ];
  Object.entries(columnNotes).forEach(([key, note]) => {
    lines.push(`- ${key}: ${note}`);
  });
  lines.push('');
  lines.push('Recordkeeping Note: NOVA exports user-entered income, expense, account, category, notes, source/client/vendor, transaction, mileage, and receipt attachment fields where available.');
  return lines.join('\n');
}

export function buildAccountCsv(accountKey, transactions, currentBalanceCents = null) {
  const rows = (transactions || [])
    .filter(t => t.accountKey === accountKey && !t.deleted)
    .sort((a, b) => a.timestamp - b.timestamp);
  const lines = ['Date,Description,Category,Amount,Balance After,Payment Method,Receipt Count,Receipt Files'];
  const totalMovement = rows.reduce((sum, t) => sum + (t.amountCents || 0), 0);
  let running = Number.isFinite(currentBalanceCents) ? currentBalanceCents - totalMovement : 0;
  for (const t of rows) {
    running += t.amountCents || 0;
    const balance = t.nextBalanceCents ?? running;
    running = balance;
    lines.push([
      dateIso(t.timestamp),
      esc(t.description),
      esc(t.category),
      (t.amountCents / 100).toFixed(2),
      (balance / 100).toFixed(2),
      esc(t.paymentMethod),
      receiptCount(t),
      esc(receiptFileSummary(t)),
    ].join(','));
  }
  return lines.join('\n');
}

export function buildAccountPdfHtml({ accountKey, accountName, transactions = [], currentBalanceCents = null }) {
  const rows = (transactions || [])
    .filter(t => t.accountKey === accountKey && !t.deleted)
    .sort((a, b) => (a.timestamp || 0) - (b.timestamp || 0));
  const totalMovement = rows.reduce((sum, t) => sum + (t.amountCents || 0), 0);
  let running = Number.isFinite(currentBalanceCents) ? currentBalanceCents - totalMovement : 0;
  const tableRows = rows.map(t => {
    running += t.amountCents || 0;
    const balance = t.nextBalanceCents ?? running;
    running = balance;
    return `
      <tr>
        <td>${htmlEsc(dateIso(t.timestamp))}</td>
        <td>${htmlEsc(t.description || '')}</td>
        <td>${htmlEsc(t.category || '')}</td>
        <td class="amount">${((t.amountCents || 0) / 100).toFixed(2)}</td>
        <td class="amount">${(balance / 100).toFixed(2)}</td>
        <td>${htmlEsc(t.sourceType || t.source || '')}</td>
        <td>${receiptCount(t)}</td>
        <td>${htmlEsc(t.id || '')}</td>
      </tr>
    `;
  }).join('');
  const exportedAt = new Date().toISOString();
  return `
    <!doctype html>
    <html>
      <head>
        <meta charset="utf-8" />
        <style>
          body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; color: #111; padding: 24px; }
          h1 { font-size: 22px; margin: 0 0 4px; }
          .meta { color: #555; font-size: 12px; margin-bottom: 18px; }
          table { width: 100%; border-collapse: collapse; font-size: 11px; }
          th { text-align: left; border-bottom: 2px solid #333; padding: 6px 4px; }
          td { border-bottom: 1px solid #ddd; padding: 5px 4px; vertical-align: top; }
          .amount { text-align: right; white-space: nowrap; }
          .empty { color: #555; font-size: 13px; margin-top: 24px; }
        </style>
      </head>
      <body>
        <h1>N.O.V.A. Account Export</h1>
        <div class="meta">
          Account: ${htmlEsc(accountName || accountKey)} (${htmlEsc(accountKey)})<br />
          Exported: ${htmlEsc(exportedAt)}<br />
          Current Balance: ${Number.isFinite(currentBalanceCents) ? `$${(currentBalanceCents / 100).toFixed(2)}` : 'Unknown'}
        </div>
        ${rows.length === 0 ? '<div class="empty">No transactions recorded for this account.</div>' : `
          <table>
            <thead>
              <tr>
                <th>Date</th>
                <th>Description</th>
                <th>Category</th>
                <th class="amount">Amount</th>
                <th class="amount">Balance After</th>
                <th>Source</th>
                <th>Receipts</th>
                <th>Transaction ID</th>
              </tr>
            </thead>
            <tbody>${tableRows}</tbody>
          </table>
        `}
      </body>
    </html>
  `;
}

export function buildBusinessIncomeCsv({ businesses = [], income = [], accountRegistry = [] }) {
  const businessNames = businessNameById(businesses);
  const accountNames = accountNameByKey(accountRegistry);
  const rows = (income || []).filter(r => !r.deleted).sort((a, b) => new Date(a.date || a.timestamp || 0) - new Date(b.date || b.timestamp || 0));
  const lines = ['Date,Business,Business ID,Vendor/Client,Category,Amount,Amount Cents,Account,Account Key,Notes,Receipt Count,Receipt Files,Transaction ID'];
  for (const r of rows) {
    lines.push([
      dateIso(r.date || r.timestamp || r.createdAt),
      esc(businessNames.get(r.businessId) || r.businessId || 'Business'),
      esc(r.businessId),
      esc(r.clientName || r.description || 'Income'),
      esc(r.category || 'business_income'),
      ((r.amountCents || 0) / 100).toFixed(2),
      Math.trunc(r.amountCents || 0),
      esc(accountNames.get(r.accountKey) || r.accountKey),
      esc(r.accountKey),
      esc(r.notes),
      receiptCount(r),
      esc(receiptFileSummary(r)),
      esc(r.transactionId),
    ].join(','));
  }
  return lines.join('\n');
}

export function buildBusinessExpenseCsv({ businesses = [], expenses = [], accountRegistry = [] }) {
  const businessNames = businessNameById(businesses);
  const accountNames = accountNameByKey(accountRegistry);
  const rows = (expenses || []).filter(r => !r.deleted).sort((a, b) => new Date(a.date || a.timestamp || 0) - new Date(b.date || b.timestamp || 0));
  const lines = ['Date,Business,Business ID,Vendor/Client,Category,Deductible?,Amount,Amount Cents,Account,Account Key,Notes,Receipt Count,Receipt Files,Transaction ID'];
  for (const r of rows) {
    lines.push([
      dateIso(r.date || r.timestamp || r.createdAt),
      esc(businessNames.get(r.businessId) || r.businessId || 'Business'),
      esc(r.businessId),
      esc(r.description || r.vendor || 'Expense'),
      esc(r.category || 'business_expense'),
      r.taxDeductible === false ? 'No' : 'Yes',
      ((r.amountCents || 0) / 100).toFixed(2),
      Math.trunc(r.amountCents || 0),
      esc(accountNames.get(r.accountKey) || r.accountKey),
      esc(r.accountKey),
      esc(r.notes || r.receiptNote),
      receiptCount(r),
      esc(receiptFileSummary(r)),
      esc(r.transactionId),
    ].join(','));
  }
  return lines.join('\n');
}

export function buildBusinessMileageCsv({ businesses = [], mileage = [] }) {
  const businessNames = businessNameById(businesses);
  const rows = (mileage || []).filter(r => !r.deleted).sort((a, b) => new Date(a.date || a.timestamp || 0) - new Date(b.date || b.timestamp || 0));
  const lines = ['Date,Business,Business ID,Category,Deductible?,Miles,Vendor/Client,Notes,IRS Rate,Mileage Deduction,Mileage Deduction Cents'];
  for (const r of rows) {
    lines.push([
      dateIso(r.date || r.timestamp || r.createdAt),
      esc(businessNames.get(r.businessId) || r.businessId || 'Business'),
      esc(r.businessId),
      esc(r.category || 'business_mileage'),
      r.taxDeductible === false ? 'No' : 'Yes',
      (r.miles || 0).toFixed(1),
      esc(r.description || r.purpose),
      esc(r.notes),
      ((r.irsRateCents || 0) / 100).toFixed(2),
      ((r.deductionCents || 0) / 100).toFixed(2),
      Math.trunc(r.deductionCents || 0),
    ].join(','));
  }
  return lines.join('\n');
}

export function buildBusinessTransactionsCsv({ businesses = [], transactions = [], accountRegistry = [] }) {
  const businessNames = businessNameById(businesses);
  const accountNames = accountNameByKey(accountRegistry);
  const rows = (transactions || [])
    .filter(t => !t.deleted && (t.source === 'business' || String(t.sourceType || '').startsWith('business_') || t.businessId))
    .sort((a, b) => (a.timestamp || 0) - (b.timestamp || 0));
  const lines = ['Date,Business,Business ID,Account,Account Key,Description,Category,Amount,Amount Cents,Balance After,Source Type,Source ID,Receipt Count,Receipt Files,Transaction ID'];
  for (const t of rows) {
    lines.push([
      dateIso(t.timestamp),
      esc(businessNames.get(t.businessId) || t.businessId || 'Business'),
      esc(t.businessId),
      esc(accountNames.get(t.accountKey) || t.accountKey),
      esc(t.accountKey),
      esc(t.description),
      esc(t.category),
      ((t.amountCents || 0) / 100).toFixed(2),
      Math.trunc(t.amountCents || 0),
      t.nextBalanceCents == null ? '' : (t.nextBalanceCents / 100).toFixed(2),
      esc(t.sourceType || t.source),
      esc(t.sourceId),
      receiptCount(t),
      esc(receiptFileSummary(t)),
      esc(t.id),
    ].join(','));
  }
  return lines.join('\n');
}

export function buildBusinessSummaryCsv({ businesses = [], income = [], expenses = [], mileage = [] }) {
  const activeBusinesses = (businesses || []).filter(b => b && b.isActive !== false);
  const businessIds = new Set([
    ...activeBusinesses.map(b => b.id).filter(Boolean),
    ...(income || []).map(r => r.businessId).filter(Boolean),
    ...(expenses || []).map(r => r.businessId).filter(Boolean),
    ...(mileage || []).map(r => r.businessId).filter(Boolean),
  ]);
  const nameMap = businessNameById(businesses);
  const lines = ['Business,Business ID,Income,Income Cents,Expenses,Expense Cents,Net,Net Cents,Miles,Mileage Deduction,Mileage Deduction Cents'];
  for (const businessId of businessIds) {
    const businessIncome = (income || []).filter(r => !r.deleted && r.businessId === businessId)
      .reduce((sum, r) => sum + (r.amountCents || 0), 0);
    const businessExpenses = (expenses || []).filter(r => !r.deleted && r.businessId === businessId)
      .reduce((sum, r) => sum + (r.amountCents || 0), 0);
    const businessMiles = (mileage || []).filter(r => !r.deleted && r.businessId === businessId)
      .reduce((sum, r) => sum + (r.miles || 0), 0);
    const mileageDeduction = (mileage || []).filter(r => !r.deleted && r.businessId === businessId)
      .reduce((sum, r) => sum + (r.deductionCents || 0), 0);
    lines.push([
      esc(nameMap.get(businessId) || businessId || 'Business'),
      esc(businessId),
      (businessIncome / 100).toFixed(2),
      businessIncome,
      (businessExpenses / 100).toFixed(2),
      businessExpenses,
      ((businessIncome - businessExpenses) / 100).toFixed(2),
      businessIncome - businessExpenses,
      businessMiles.toFixed(1),
      (mileageDeduction / 100).toFixed(2),
      mileageDeduction,
    ].join(','));
  }
  return lines.join('\n');
}

export function validateImportJson(parsed) {
  if (!parsed || typeof parsed !== 'object') return { valid: false, reason: 'File is not a valid JSON object.' };
  if (typeof parsed.schemaVersion !== 'number') return { valid: false, reason: 'Missing or invalid schemaVersion.' };
  if (!parsed.data || typeof parsed.data !== 'object') return { valid: false, reason: 'Missing data object.' };
  if (parsed.scope && !['all', 'business', 'household', 'accounts'].includes(parsed.scope)) {
    return { valid: false, reason: `Unsupported backup scope: ${parsed.scope}` };
  }
  const invalidKey = Object.keys(parsed.data).find(key => !key.startsWith('nova_v2_'));
  if (invalidKey) return { valid: false, reason: `Unexpected key in backup: ${invalidKey}` };
  return { valid: true, reason: '' };
}
