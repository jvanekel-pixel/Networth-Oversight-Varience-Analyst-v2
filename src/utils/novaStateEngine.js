import { NOVA_EVENT_DEFAULTS, NOVA_STATE_META } from '../config/novaState.config';
import { createNovaResponsePicker } from './novaResponseLibrary';

const COMMA_THRESHOLD_CENTS = 100000;
const PROFILE_KEYS = ['household', 'personal', 'business'];
const novaResponsePicker = createNovaResponsePicker(NOVA_STATE_META);

function safeStateKey(stateKey) {
  return NOVA_STATE_META[stateKey] ? stateKey : 'neutral';
}

export function didCrossCommaThreshold(previousCents = 0, nextCents = 0) {
  if (previousCents < COMMA_THRESHOLD_CENTS && nextCents >= COMMA_THRESHOLD_CENTS) return 'comma';
  if (previousCents >= COMMA_THRESHOLD_CENTS && nextCents < COMMA_THRESHOLD_CENTS) return 'comma_lost';
  return null;
}

export function getDominantVarianceState(varianceCache = {}) {
  const states = PROFILE_KEYS.map((key) => varianceCache?.[key]?.state).filter(Boolean);
  if (states.includes('red')) return 'red';
  if (states.includes('yellow')) return 'yellow';
  if (states.includes('green')) return 'green';
  return 'neutral';
}

function chooseFromPool(pool, avoid = null) {
  const candidates = (pool || []).filter(Boolean);
  if (candidates.length === 0) return null;
  const filtered = candidates.filter(key => key !== avoid);
  const activePool = filtered.length > 0 ? filtered : candidates;
  return activePool[Math.floor(Math.random() * activePool.length)];
}

export function getNovaFaceForState(stateKey, options = {}) {
  const meta = NOVA_STATE_META[safeStateKey(stateKey)];
  const eventPool = options.eventType && meta.eventFacePools?.[options.eventType];
  const pool = eventPool || meta.facePool || [meta.face || 'neutral'];
  return chooseFromPool(pool, options.avoidFaceKey) || meta.face || 'neutral';
}

export function getNovaStateLabel(stateKey) {
  return NOVA_STATE_META[safeStateKey(stateKey)].label || 'STANDBY';
}

export function pickNovaLine(stateKey, options = {}) {
  return pickNovaResponse(stateKey, options).text;
}

export function pickNovaResponse(stateKey, options = {}) {
  const safeKey = safeStateKey(stateKey);
  const entry = novaResponsePicker.pickEntry({
    stateKey: safeKey,
    eventType: options.eventType || null,
    snapshot: options.snapshot || {},
    avoidText: options.avoidText || '',
  });
  return {
    ...(entry || {}),
    stateKey: safeKey,
    text: entry?.text || novaResponsePicker.pick({
      stateKey: safeKey,
      eventType: options.eventType || null,
      snapshot: options.snapshot || {},
      avoidText: options.avoidText || '',
    }),
    faceKey: entry?.faceKey || getNovaFaceForState(safeKey, {
      eventType: options.eventType || null,
      avoidFaceKey: options.avoidFaceKey || null,
    }),
  };
}

export function getNovaResponseStats() {
  return novaResponsePicker.stats();
}

export function resolveNovaStateForEvent(eventType, snapshot = {}, context = {}) {
  if (context.stateKey) return safeStateKey(context.stateKey);

  const dominant = getDominantVarianceState(snapshot.varianceCache);
  const commaState = didCrossCommaThreshold(context.previousBalanceCents, context.nextBalanceCents);
  const incomeLike = context.amountCents > 0 && ['income', 'paycheck', 'scheduled_income'].includes(String(context.category || '').toLowerCase());

  if (dominant === 'red' && eventType !== 'floor_warning') return 'red';
  if (dominant === 'yellow' && eventType !== 'floor_warning') return 'yellow';
  if (context.isSavingsWithdrawal) return 'savings_withdrawal';
  if (context.isSavingsAccount && context.amountCents < 0) return 'savings_withdrawal';
  if (commaState) return commaState;
  if (incomeLike) return 'payday';

  if (eventType === 'transaction') {
    if (context.groceryLimitExceeded) return 'grocery_warning';
    return dominant;
  }

  if (eventType === 'balance_adjustment') {
    if (context.isSavingsAccount && context.nextBalanceCents < context.previousBalanceCents) return 'savings_withdrawal';
    return dominant;
  }

  if (eventType === 'cycle_reset' && context.zeroWaste) return 'zero_waste';

  const defaultState = NOVA_EVENT_DEFAULTS[eventType] || dominant;
  if (defaultState === 'green' && (dominant === 'red' || dominant === 'yellow')) return dominant;
  return safeStateKey(defaultState);
}

export function getNovaStatePayload(eventType, snapshot = {}, context = {}) {
  const stateKey = resolveNovaStateForEvent(eventType, snapshot, context);
  const selectedResponse = pickNovaResponse(stateKey, {
    eventType,
    snapshot,
    avoidText: snapshot.currentFlavorText,
    avoidFaceKey: snapshot.currentNovaFace,
  });
  return {
    eventType,
    stateKey,
    faceKey: selectedResponse.faceKey || getNovaFaceForState(stateKey, { eventType }),
    label: getNovaStateLabel(stateKey),
    text: selectedResponse.text,
    timestamp: Date.now(),
  };
}
