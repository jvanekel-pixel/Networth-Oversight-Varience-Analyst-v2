import responsePack from '../data/nova-responses.json';
import expansionPack from '../data/nova-expanded-responses.json';
import { TIER_ORDER } from '../config/badges.config';

const EMPTY_SET = new Set();
const RESPONSE_PACKS = [responsePack, expansionPack];

function asArray(value) {
  if (!value) return [];
  return Array.isArray(value) ? value : [value];
}

function normalizeIdPart(value) {
  return String(value || 'nova')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '') || 'nova';
}

function getEntryText(entry) {
  if (typeof entry === 'string') return entry;
  if (!entry || typeof entry !== 'object') return '';
  return entry.text || entry.line || entry.copy || entry.response || '';
}

function normalizeUnlocks(entry) {
  if (!entry || typeof entry !== 'object') return [];
  const raw = entry.unlocks || entry.unlock || entry.requires || entry.badges || entry.badge;
  return asArray(raw).map((unlock) => {
    if (typeof unlock === 'string') return { badgeId: unlock };
    if (!unlock || typeof unlock !== 'object') return null;
    return {
      badgeId: unlock.badgeId || unlock.badge || unlock.id,
      minTier: unlock.minTier || unlock.tier || null,
    };
  }).filter(unlock => unlock?.badgeId);
}

function normalizeResponseEntry(entry, defaults = {}) {
  const text = String(getEntryText(entry) || '').trim();
  if (!text) return null;

  const objectEntry = entry && typeof entry === 'object' && !Array.isArray(entry);
  const stateKey = objectEntry ? (entry.state || entry.stateKey || defaults.stateKey) : defaults.stateKey;
  const eventType = objectEntry ? (entry.event || entry.eventType || defaults.eventType) : defaults.eventType;
  const index = defaults.index ?? 0;
  const source = defaults.source || 'nova';
  const id = objectEntry && entry.id
    ? String(entry.id)
    : `${normalizeIdPart(source)}_${normalizeIdPart(stateKey || eventType || 'line')}_${index}`;

  return {
    id,
    text,
    stateKey: stateKey || null,
    eventType: eventType || null,
    tags: objectEntry ? asArray(entry.tags).map(String).filter(Boolean) : [],
    faceKey: objectEntry ? (entry.faceKey || entry.face || null) : null,
    animationKey: objectEntry ? (entry.animationKey || entry.animation || null) : null,
    weight: Math.max(1, Math.floor(objectEntry ? (entry.weight || 1) : 1)),
    unlocks: normalizeUnlocks(entry),
    source,
  };
}

function addUnique(target, entries) {
  const seen = new Set(target.map(entry => entry.text));
  for (const entry of entries) {
    if (!entry || seen.has(entry.text)) continue;
    target.push(entry);
    seen.add(entry.text);
  }
}

function normalizeMap(map, { source, kind }) {
  const normalized = {};
  Object.entries(map || {}).forEach(([key, value]) => {
    const entries = asArray(value)
      .map((entry, index) => normalizeResponseEntry(entry, {
        source,
        index,
        stateKey: kind === 'state' ? key : undefined,
        eventType: kind === 'event' ? key : undefined,
      }))
      .filter(Boolean);
    normalized[key] = entries;
  });
  return normalized;
}

function normalizePackLines(pack, source) {
  const state = {};
  const event = {};
  const lines = asArray(pack?.lines);

  lines.forEach((entry, index) => {
    const normalized = normalizeResponseEntry(entry, { source, index });
    if (!normalized) return;
    if (normalized.stateKey) {
      if (!state[normalized.stateKey]) state[normalized.stateKey] = [];
      state[normalized.stateKey].push(normalized);
    }
    if (normalized.eventType) {
      if (!event[normalized.eventType]) event[normalized.eventType] = [];
      event[normalized.eventType].push(normalized);
    }
  });

  return { state, event };
}

function mergePools(...poolMaps) {
  const merged = {};
  poolMaps.forEach((poolMap) => {
    Object.entries(poolMap || {}).forEach(([key, entries]) => {
      if (!merged[key]) merged[key] = [];
      addUnique(merged[key], entries || []);
    });
  });
  return merged;
}

function normalizeResponsePack(rawPack = {}) {
  const stateMaps = [];
  const eventMaps = [];

  stateMaps.push(normalizeMap(rawPack.state || rawPack.states, { source: 'nova_responses', kind: 'state' }));
  eventMaps.push(normalizeMap(rawPack.event || rawPack.events, { source: 'nova_responses', kind: 'event' }));

  asArray(rawPack.packs).forEach((pack, packIndex) => {
    const source = pack?.packId || pack?.id || `nova_pack_${packIndex + 1}`;
    stateMaps.push(normalizeMap(pack?.state || pack?.states, { source, kind: 'state' }));
    eventMaps.push(normalizeMap(pack?.event || pack?.events, { source, kind: 'event' }));
    const lineMaps = normalizePackLines(pack, source);
    stateMaps.push(lineMaps.state);
    eventMaps.push(lineMaps.event);
  });

  return {
    state: mergePools(...stateMaps),
    event: mergePools(...eventMaps),
  };
}

function buildBaseStatePools(stateMeta = {}) {
  const pools = {};
  Object.entries(stateMeta).forEach(([stateKey, meta]) => {
    pools[stateKey] = (meta.copy || [])
      .map((line, index) => normalizeResponseEntry(line, {
        source: 'builtin',
        stateKey,
        index,
      }))
      .filter(Boolean);
  });
  return pools;
}

function expandStatePools(basePools, packPools, stateMeta = {}) {
  const expanded = {};
  const allKeys = new Set([
    ...Object.keys(basePools || {}),
    ...Object.keys(packPools || {}),
    ...Object.keys(stateMeta || {}),
  ]);

  allKeys.forEach((stateKey) => {
    const sourceStates = [
      stateKey,
      ...asArray(stateMeta?.[stateKey]?.copySourceStates),
    ];
    const entries = [];
    sourceStates.forEach((sourceState) => {
      addUnique(entries, basePools?.[sourceState] || []);
      addUnique(entries, packPools?.[sourceState] || []);
    });
    expanded[stateKey] = entries;
  });

  return expanded;
}

function buildLibrary(stateMeta = {}, rawPacks = RESPONSE_PACKS) {
  const baseStatePools = buildBaseStatePools(stateMeta);
  const normalizedPacks = asArray(rawPacks).map(normalizeResponsePack);
  const packStatePools = mergePools(...normalizedPacks.map(pack => pack.state));
  const packEventPools = mergePools(...normalizedPacks.map(pack => pack.event));
  return {
    state: expandStatePools(baseStatePools, packStatePools, stateMeta),
    event: packEventPools,
  };
}

function getLegacyEarnedBadgeIds(snapshot = {}) {
  const badges = snapshot.badges;
  if (!badges) return [];

  if (Array.isArray(badges)) {
    return badges
      .filter(badge => badge?.earned || badge?.unlocked || badge?.tier || badge?.unlockedAt)
      .map(badge => badge.id || badge.badgeId || badge.key)
      .filter(Boolean);
  }

  if (typeof badges === 'object') {
    return Object.entries(badges)
      .filter(([, value]) => {
        if (value === true || typeof value === 'number' || typeof value === 'string') return true;
        return !!(value?.earned || value?.unlocked || value?.tier || value?.unlockedAt);
      })
      .map(([badgeId]) => badgeId)
      .filter(Boolean);
  }

  return [];
}

function getTieredBadgeSnapshot(snapshot = {}) {
  return snapshot.badgeState || {};
}

function getEarnedBadgeIds(snapshot = {}) {
  return new Set([
    ...getLegacyEarnedBadgeIds(snapshot),
    ...Object.entries(getTieredBadgeSnapshot(snapshot))
      .filter(([, value]) => !!value?.tier)
      .map(([badgeId]) => badgeId),
  ]);
}

function tierMeetsMinimum(actualTier, minimumTier) {
  if (!minimumTier) return !!actualTier;
  const actualIndex = TIER_ORDER.indexOf(actualTier);
  const minimumIndex = TIER_ORDER.indexOf(minimumTier);
  return actualIndex >= 0 && minimumIndex >= 0 && actualIndex >= minimumIndex;
}

function isEntryUnlocked(entry, snapshot = {}, earnedBadgeIds = EMPTY_SET) {
  if (!entry?.unlocks || entry.unlocks.length === 0) return true;
  const badgeState = getTieredBadgeSnapshot(snapshot);
  return entry.unlocks.every((unlock) => {
    if (!earnedBadgeIds.has(unlock.badgeId)) return false;
    if (!unlock.minTier) return true;
    return tierMeetsMinimum(badgeState?.[unlock.badgeId]?.tier, unlock.minTier);
  });
}

function filterUnlocked(entries, snapshot) {
  const earnedBadgeIds = getEarnedBadgeIds(snapshot);
  return (entries || []).filter(entry => isEntryUnlocked(entry, snapshot, earnedBadgeIds));
}

function chooseWeighted(entries, avoidText = '') {
  const candidates = (entries || []).filter(entry => entry.text !== avoidText);
  const pool = candidates.length > 0 ? candidates : entries;
  if (!pool || pool.length === 0) return null;
  const totalWeight = pool.reduce((sum, entry) => sum + (entry.weight || 1), 0);
  let cursor = Math.random() * totalWeight;
  for (const entry of pool) {
    cursor -= entry.weight || 1;
    if (cursor <= 0) return entry;
  }
  return pool[pool.length - 1];
}

export function createNovaResponsePicker(stateMeta) {
  const library = buildLibrary(stateMeta, RESPONSE_PACKS);

  return {
    pickEntry({ stateKey = 'neutral', eventType = null, snapshot = {}, avoidText = '' } = {}) {
      const eventEntries = eventType ? filterUnlocked(library.event[eventType], snapshot) : [];
      const stateEntries = filterUnlocked(library.state[stateKey], snapshot);
      const fallbackEntries = filterUnlocked(library.state.neutral, snapshot);
      return chooseWeighted(
        eventEntries.length > 0 ? eventEntries : (stateEntries.length > 0 ? stateEntries : fallbackEntries),
        avoidText,
      );
    },
    pick(options = {}) {
      const selected = this.pickEntry(options);
      return selected?.text || '';
    },
    stats() {
      return {
        states: Object.fromEntries(Object.entries(library.state).map(([key, entries]) => [key, entries.length])),
        events: Object.fromEntries(Object.entries(library.event).map(([key, entries]) => [key, entries.length])),
      };
    },
  };
}
