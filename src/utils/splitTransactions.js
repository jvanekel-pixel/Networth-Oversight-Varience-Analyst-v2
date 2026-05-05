export function makeSplitGroupId(prefix = 'split') {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

export function getAccountKey(account) {
  return account ? (account.legacyKey || account.id) : null;
}

export function buildActiveAccountOptions(accountRegistry = [], accounts = {}, role = null) {
  const registryOptions = (accountRegistry || [])
    .filter(account => account && account.isActive !== false && (!role || account.role === role))
    .map(account => ({
      key: getAccountKey(account),
      label: account.name || account.id,
      role: account.role || null,
      balanceCents: accounts?.[getAccountKey(account)] || 0,
    }))
    .filter(account => account.key);

  if (registryOptions.length > 0) return registryOptions;

  return Object.keys(accounts || {}).map(key => ({
    key,
    label: key,
    role: null,
    balanceCents: accounts?.[key] || 0,
  }));
}

export function isSplitTransactionPayload(payload) {
  return !!payload?.splitTransaction && Array.isArray(payload?.splits);
}

function normalizeCents(value) {
  return Math.floor(Number(value) || 0);
}

function getCommonPayloadFields(payload = {}, extras = {}) {
  return {
    ...extras,
    paymentMethod: payload.paymentMethod ?? extras.paymentMethod,
    timestamp: payload.timestamp ?? extras.timestamp,
    source: payload.source ?? extras.source,
    sourceType: payload.sourceType ?? extras.sourceType,
    sourceId: payload.sourceId ?? extras.sourceId,
    businessId: payload.businessId ?? extras.businessId,
    groceryScope: payload.groceryScope ?? extras.groceryScope,
    receiptAttachments: payload.receiptAttachments ?? extras.receiptAttachments,
  };
}

export async function submitTransactionPayload(logTransaction, payload = {}, fallbackAccountKey = null, extras = {}) {
  if (!isSplitTransactionPayload(payload)) {
    const {
      splitTransaction,
      splits,
      splitGroupId,
      splitPart,
      splitTotalParts,
      splitTotalCents,
      splitParentDescription,
      ...singlePayload
    } = payload || {};
    return logTransaction({
      ...extras,
      ...singlePayload,
      accountKey: singlePayload.accountKey || fallbackAccountKey,
    });
  }

  const lines = payload.splits.slice(0, 2);
  if (lines.length !== 2) {
    throw new Error('Split transactions must contain exactly two lines.');
  }

  const signedTotalCents = normalizeCents(payload.amountCents);
  const lineTotalCents = lines.reduce((sum, line) => sum + normalizeCents(line.amountCents), 0);
  if (lineTotalCents !== signedTotalCents) {
    throw new Error('Split line amounts must equal the transaction total.');
  }

  const splitGroupId = payload.splitGroupId || makeSplitGroupId();
  const splitParentDescription = String(payload.description || '').trim();
  const common = getCommonPayloadFields(payload, extras);
  const results = [];

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index] || {};
    const accountKey = line.accountKey || fallbackAccountKey;
    if (!accountKey) {
      throw new Error('Each split line needs an account.');
    }
    const amountCents = normalizeCents(line.amountCents);
    if (amountCents === 0) {
      throw new Error('Each split line needs a non-zero amount.');
    }

    const tx = await logTransaction({
      ...common,
      accountKey,
      amountCents,
      category: line.category || payload.category,
      description: String(line.description || splitParentDescription || '').trim(),
      splitGroupId,
      splitPart: index + 1,
      splitTotalParts: 2,
      splitTotalCents: signedTotalCents,
      splitParentDescription,
    });
    results.push(tx);
  }

  return results;
}
