import { parseBillInput } from './currency';
import { canonicalCategoryLabel, CATEGORY_UNCATEGORIZED } from './spendingCategories';

const DEFAULT_QUICK_LOG_SOURCE = 'quick_log';

const WORD_NUMBERS = {
  one: 1,
  two: 2,
  three: 3,
  four: 4,
  five: 5,
  six: 6,
  seven: 7,
  eight: 8,
  nine: 9,
  ten: 10,
  eleven: 11,
  twelve: 12,
  thirteen: 13,
  fourteen: 14,
  fifteen: 15,
  twenty: 20,
  thirty: 30,
  forty: 40,
  fifty: 50,
};

const CATEGORY_KEYWORDS = [
  { category: 'Dining Out', words: ['coffee', 'cafe', 'latte', 'restaurant', 'lunch', 'dinner', 'breakfast', 'takeout', 'doordash', 'ubereats'] },
  { category: 'Entertainment', words: ['movie', 'cinema', 'concert', 'show', 'game', 'streaming'] },
  { category: 'Groceries', words: ['grocery', 'groceries', 'market', 'costco', 'walmart', 'aldi', 'produce'] },
  { category: 'Transportation', words: ['gas', 'fuel', 'uber', 'lyft', 'taxi', 'parking', 'train', 'bus'] },
  { category: 'Home', words: ['home', 'hardware', 'cleaning', 'furniture', 'target'] },
  { category: 'Health', words: ['doctor', 'pharmacy', 'medicine', 'rx', 'dentist', 'therapy'] },
  { category: 'Business Supplies', words: ['office', 'client', 'business', 'supplies', 'software'] },
  { category: 'Subscriptions', words: ['subscription', 'netflix', 'spotify', 'hulu', 'apple'] },
];

function decodeValue(value) {
  try {
    return decodeURIComponent(String(value || '').replace(/\+/g, ' '));
  } catch {
    return String(value || '').replace(/\+/g, ' ');
  }
}

function queryParams(url) {
  const query = String(url || '').split('?')[1] || '';
  return query.split('&').reduce((params, pair) => {
    if (!pair) return params;
    const [rawKey, ...rest] = pair.split('=');
    const key = decodeValue(rawKey);
    params[key] = decodeValue(rest.join('='));
    return params;
  }, {});
}

function routeHost(url) {
  const match = String(url || '').match(/^nova:\/\/([^/?#]+)/i);
  return match ? match[1].toLowerCase() : null;
}

function amountRawFromCents(cents) {
  const abs = Math.abs(Math.trunc(Number(cents) || 0));
  const dollars = Math.floor(abs / 100);
  const pennies = abs % 100;
  return pennies === 0 ? String(dollars) : `${dollars}.${String(pennies).padStart(2, '0')}`;
}

function parseAmountFromText(text) {
  const raw = String(text || '').trim();
  const numericMatch = raw.match(/(?:^|\s)([-+]?\$?\d+(?:[.,]\d{1,2})?|\$[-+]?\d+(?:[.,]\d{1,2})?)(?=\s|$)/);
  if (numericMatch) {
    const amountToken = numericMatch[1];
    const amountRaw = amountToken.replace(/[^\d.,-]/g, '').replace(',', '.');
    const amountCents = Math.abs(parseBillInput(amountRaw));
    return {
      amountCents,
      amountRaw: amountRawFromCents(amountCents),
      textWithoutAmount: `${raw.slice(0, numericMatch.index)} ${raw.slice(numericMatch.index + numericMatch[0].length)}`.trim(),
    };
  }

  const words = raw.toLowerCase().split(/\s+/);
  const wordIndex = words.findIndex(word => WORD_NUMBERS[word.replace(/[^a-z]/g, '')] != null);
  if (wordIndex >= 0) {
    const amount = WORD_NUMBERS[words[wordIndex].replace(/[^a-z]/g, '')];
    const amountCents = amount * 100;
    const originalWords = raw.split(/\s+/);
    originalWords.splice(wordIndex, 1);
    return {
      amountCents,
      amountRaw: amountRawFromCents(amountCents),
      textWithoutAmount: originalWords.join(' '),
    };
  }

  return {
    amountCents: 0,
    amountRaw: '',
    textWithoutAmount: raw,
  };
}

function cleanDescription(text) {
  return String(text || '')
    .replace(/\b(dollars?|bucks?|usd|for|on|spent|paid|log|expense|transaction|record)\b/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function categoryFromText(description, availableCategories = []) {
  const lowered = String(description || '').toLowerCase();
  const category = CATEGORY_KEYWORDS.find(entry => entry.words.some(word => lowered.includes(word)))?.category || '';
  if (!category) return '';
  const available = (availableCategories || []).find(item => canonicalCategoryLabel(item).toLowerCase() === canonicalCategoryLabel(category).toLowerCase());
  return available || category;
}

export function parseQuickLogText(text, availableCategories = []) {
  const raw = String(text || '').trim();
  const parsedAmount = parseAmountFromText(raw);
  const description = cleanDescription(parsedAmount.textWithoutAmount) || raw;
  return {
    raw,
    amountCents: parsedAmount.amountCents,
    amountRaw: parsedAmount.amountRaw,
    description,
    category: categoryFromText(description, availableCategories) || CATEGORY_UNCATEGORIZED,
  };
}

export function parseNovaQuickLogUrl(url) {
  const host = routeHost(url);
  if (host !== 'record-transaction' && host !== 'quick-log') return null;
  const params = queryParams(url);
  const quickText = params.text || params.quickText || params.voice || params.q || '';
  const parsedText = parseQuickLogText(quickText);
  const amountCents = params.amountCents
    ? Math.abs(Math.trunc(Number(params.amountCents) || 0))
    : params.amount
      ? Math.abs(parseBillInput(params.amount))
      : parsedText.amountCents;
  const type = String(params.type || '').toLowerCase() === 'income' || String(quickText).trim().startsWith('+')
    ? 'income'
    : 'expense';
  const description = params.description || params.desc || parsedText.description || (host === 'quick-log' ? 'Quick log' : '');
  const category = params.category
    ? canonicalCategoryLabel(params.category, CATEGORY_UNCATEGORIZED)
    : parsedText.category;
  const autoSubmit = ['1', 'true', 'yes'].includes(String(params.auto || params.autoSubmit || params.autosave || '').toLowerCase());

  return {
    host,
    accountKey: params.accountKey || params.account || null,
    source: params.source || (host === 'quick-log' ? 'tasker_shortcut' : DEFAULT_QUICK_LOG_SOURCE),
    type,
    autoSubmit,
    text: quickText,
    amountCents,
    amountRaw: amountRawFromCents(amountCents),
    description,
    category,
    draftId: `quick_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
  };
}
